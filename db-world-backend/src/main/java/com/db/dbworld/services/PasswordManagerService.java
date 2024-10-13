package com.db.dbworld.services;

import com.db.dbworld.entities.user.PasswordManagerCredential;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.exceptions.ResourceNotFoundException;
import com.db.dbworld.payloads.Credential;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.payloads.user.UserDto;
import com.db.dbworld.security.CypherAesHelper;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.SerializationUtils;

import javax.crypto.*;
import javax.crypto.spec.IvParameterSpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.InvalidAlgorithmParameterException;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.security.spec.InvalidKeySpecException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

@Service
public class PasswordManagerService {

    @Autowired
    private ModelMapper modelMapper;

    @Autowired
    private CypherAesHelper cypherAesHelper;

    @Autowired
    private DbWorldUtils dbWorldUtils;

    public UserDto.PasswordManagerCredential createPasswordMangerCredential(String userId, String host, Credential credential) throws NoSuchAlgorithmException,
            InvalidKeySpecException, InvalidAlgorithmParameterException, NoSuchPaddingException,
            IllegalBlockSizeException, IOException, InvalidKeyException {

        //host bytes encode
        byte[] saltBytes = Base64.getEncoder().encode(host.getBytes(StandardCharsets.UTF_8));

        IvParameterSpec ivParameterSpec = cypherAesHelper.generateIv();
        SecretKey secretKey = cypherAesHelper.getKeyFromPassword(userId, Arrays.toString(saltBytes));
        SealedObject sealedObject = cypherAesHelper.encryptObject(DbWorldConstants.ENCRYPT_ALGORITHM,
                credential, secretKey, ivParameterSpec);

        byte[] sealedObjectByte = SerializationUtils.serialize(sealedObject);

        //create new sealedObject list
        List<byte[]> sealedObjectList = new ArrayList<>();
        sealedObjectList.add(sealedObjectByte);

        UserDto.PasswordManagerCredential passwordManagerCredentialDto = new UserDto.PasswordManagerCredential();
        passwordManagerCredentialDto.setHost(host);
        passwordManagerCredentialDto.setCredentials(sealedObjectList);
        passwordManagerCredentialDto.setIvParameterSpec(ivParameterSpec.getIV());

        return passwordManagerCredentialDto;
    }

    public List<ResponsePayloads.PasswordManagerCredential> decryptCredential(String userId, List<PasswordManagerCredential> passwordManager) {

//        Credential credential = new Credential();
        List<ResponsePayloads.PasswordManagerCredential> passwordManagerResponse = passwordManager.stream().map(passwordManagerCredential ->
        {
            List<Credential> credentials = passwordManagerCredential.getCredentials().stream().map(
                    credentialBytes -> {
                        Credential credential = null;
                        try {
                            credential = (Credential) cypherAesHelper.decryptObject(
                                    DbWorldConstants.ENCRYPT_ALGORITHM,
                                    (SealedObject) dbWorldUtils.deserialize(credentialBytes),
                                    cypherAesHelper.getKeyFromPassword(userId, getSaltFromHost(passwordManagerCredential.getHost())),
                                    new IvParameterSpec(passwordManagerCredential.getIvParameterSpec())
                            );
                        } catch (NoSuchPaddingException | IllegalBlockSizeException |
                                 InvalidAlgorithmParameterException | NoSuchAlgorithmException |
                                 InvalidKeyException | ClassNotFoundException | BadPaddingException | IOException |
                                 InvalidKeySpecException e) {
                            throw new DbWorldException(e.getLocalizedMessage());
                        }
                        return credential;
                    }).toList();

            ResponsePayloads.PasswordManagerCredential passwordManagerCredential1 = new ResponsePayloads.PasswordManagerCredential();
            passwordManagerCredential1.setId(passwordManagerCredential.getId().toString());
            passwordManagerCredential1.setHost(passwordManagerCredential.getHost());
            passwordManagerCredential1.setCredentials(credentials);
            return passwordManagerCredential1;
        }).toList();

        return passwordManagerResponse;

    }

    public String getSaltFromHost(String host) {
        return Arrays.toString(Base64.getEncoder().encode(host.getBytes(StandardCharsets.UTF_8)));
    }

    public List<PasswordManagerCredential> addNewCredential(
            String userId,
            List<PasswordManagerCredential> passwordManagerCredentialList,
            String host, Credential credential
    ) throws InvalidAlgorithmParameterException, NoSuchPaddingException, IllegalBlockSizeException, NoSuchAlgorithmException, InvalidKeySpecException, IOException, InvalidKeyException {
        byte[] saltBytes = Base64.getEncoder().encode(host.getBytes(StandardCharsets.UTF_8));

        if (passwordManagerCredentialList.size() == 0) {

            UserDto.PasswordManagerCredential passwordManagerCredentialDto = createPasswordMangerCredential(userId, host, credential);
            passwordManagerCredentialList.add(this.modelMapper.map(passwordManagerCredentialDto, PasswordManagerCredential.class));

        } else {
            List<PasswordManagerCredential> hostFilterCredentials = passwordManagerCredentialList.stream().filter(
                    passwordManagerCredential ->
                            passwordManagerCredential.getHost().equalsIgnoreCase(host)
            ).toList();
            if (hostFilterCredentials.size() == 0) {
                UserDto.PasswordManagerCredential passwordManagerCredentialDto = createPasswordMangerCredential(userId, host, credential);
                passwordManagerCredentialList.add(this.modelMapper.map(passwordManagerCredentialDto, PasswordManagerCredential.class));
            } else {
                PasswordManagerCredential hostFilterCredential = hostFilterCredentials.get(0);

                //sealed new credential
                SecretKey secretKey = cypherAesHelper.getKeyFromPassword(userId, Arrays.toString(saltBytes));
                SealedObject newSealedObject = cypherAesHelper.encryptObject(
                        DbWorldConstants.ENCRYPT_ALGORITHM,
                        credential, secretKey,
                        new IvParameterSpec(hostFilterCredential.getIvParameterSpec())
                );

                //add it in sealedObjectList
                hostFilterCredential.getCredentials().add(SerializationUtils.serialize(newSealedObject));

                //update password manager
                passwordManagerCredentialList.stream().filter(
                        passwordManagerCredential ->
                                !passwordManagerCredential.getHost().equalsIgnoreCase(host)
                ).collect(Collectors.toList()).add(hostFilterCredential);

            }
        }
        return passwordManagerCredentialList;
    }

    public PasswordManagerCredential getUpdatedCredential(
            String userId,
            List<PasswordManagerCredential> passwordManager,
            String host, Credential credential
    ) {
        List<PasswordManagerCredential> hostFilterCredentials = passwordManager.stream().filter(
                passwordManagerCredential -> passwordManagerCredential.getHost().equalsIgnoreCase(host)
        ).toList();

        if (hostFilterCredentials.size() == 0) {
            throw new ResourceNotFoundException("Password Manager Credential", "Host", host);
        } else {
            PasswordManagerCredential hostFilterCredential = hostFilterCredentials.get(0);
            AtomicBoolean isCredentialIdFound = new AtomicBoolean(false);
            List<byte[]> updatedHostFilteredCredential = hostFilterCredential.getCredentials().stream().map(
                    credentialBytes -> {
                        try {
                            //decrypt credential
                            Credential decryptedCredential = (Credential) cypherAesHelper.decryptObject(
                                    DbWorldConstants.ENCRYPT_ALGORITHM,
                                    (SealedObject) dbWorldUtils.deserialize(credentialBytes),
                                    cypherAesHelper.getKeyFromPassword(userId, getSaltFromHost(host)),
                                    new IvParameterSpec(hostFilterCredential.getIvParameterSpec())
                            );

                            //if credential id found then update it
                            if (credential.getId() == decryptedCredential.getId()) {
                                isCredentialIdFound.set(true);
                                this.modelMapper.map(credential, decryptedCredential);
                            }

                            //decrypt credential
                            SealedObject sealedObject = cypherAesHelper.encryptObject(
                                    DbWorldConstants.ENCRYPT_ALGORITHM,
                                    decryptedCredential,
                                    cypherAesHelper.getKeyFromPassword(userId, getSaltFromHost(host)),
                                    new IvParameterSpec(hostFilterCredential.getIvParameterSpec())
                            );

                            return dbWorldUtils.serialize(sealedObject);

                        } catch (NoSuchPaddingException | NoSuchAlgorithmException |
                                 InvalidAlgorithmParameterException | InvalidKeyException | ClassNotFoundException |
                                 BadPaddingException | IllegalBlockSizeException | IOException |
                                 InvalidKeySpecException e) {
                            throw new DbWorldException(e.getMessage());
                        }
                    }).toList();

            if (!isCredentialIdFound.get()) {
                throw new ResourceNotFoundException("Password Manager Credential", "credential id", String.valueOf(credential.getId()));
            } else {
                hostFilterCredential.setCredentials(updatedHostFilteredCredential);
            }

            return hostFilterCredential;

        }

    }

    public PasswordManagerCredential deleteCredential(
            String userId,
            List<PasswordManagerCredential> passwordManager,
            String passwordMangerId,
            long credentialId
    ) {
        List<PasswordManagerCredential> hostFilterCredentials = passwordManager.stream().filter(
                passwordManagerCredential -> passwordManagerCredential.getId().toString().equalsIgnoreCase(passwordMangerId)
        ).toList();
        if (hostFilterCredentials.size() == 0) {
            throw new ResourceNotFoundException("Password Manager Credential", "Id", passwordMangerId);
        } else {
            PasswordManagerCredential filterCredential = hostFilterCredentials.get(0);
            List<byte[]> updatedCredentialBytes = filterCredential.getCredentials().stream().filter(
                    credentialBytes -> {
                        try {
                            return ((Credential) cypherAesHelper.decryptObject(
                                    DbWorldConstants.ENCRYPT_ALGORITHM,
                                    (SealedObject) dbWorldUtils.deserialize(credentialBytes),
                                    cypherAesHelper.getKeyFromPassword(userId, getSaltFromHost(filterCredential.getHost())),
                                    new IvParameterSpec(filterCredential.getIvParameterSpec())
                            )).getId() != credentialId;
                        } catch (NoSuchPaddingException | NoSuchAlgorithmException |
                                 InvalidAlgorithmParameterException | InvalidKeyException | ClassNotFoundException |
                                 BadPaddingException | IllegalBlockSizeException | IOException |
                                 InvalidKeySpecException e) {
                            throw new DbWorldException(e.getMessage());
                        }
                    }).toList();
            filterCredential.setCredentials(updatedCredentialBytes);
            return filterCredential;
        }
    }

}
