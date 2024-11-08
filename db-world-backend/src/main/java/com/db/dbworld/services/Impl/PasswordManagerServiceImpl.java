package com.db.dbworld.services.Impl;

import com.db.dbworld.dao.pm.CredentialsRepository;
import com.db.dbworld.dao.pm.HostRepository;
import com.db.dbworld.dao.pm.PasswordManagerRepository;
import com.db.dbworld.entities.pm.CredentialEntity;
import com.db.dbworld.entities.pm.HostEntity;
import com.db.dbworld.entities.pm.PasswordManagerEntity;
import com.db.dbworld.entities.user.UserEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.exceptions.ResourceNotFoundException;
import com.db.dbworld.payloads.pm.CredentialDto;
import com.db.dbworld.payloads.pm.HostDto;
import com.db.dbworld.payloads.pm.PasswordManagerDto;
import com.db.dbworld.services.PasswordManagerService;
import com.db.dbworld.services.UserService;
import com.db.dbworld.utils.DbWorldConstants;
import jakarta.persistence.EntityManager;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Service
public class PasswordManagerServiceImpl implements PasswordManagerService {

    @Autowired
    private PasswordManagerRepository passwordManagerRepository;

    @Autowired
    private HostRepository hostRepository;

    @Autowired
    private CredentialsRepository credentialsRepository;

    @Autowired
    private UserService userService;

    @Autowired
    private ModelMapper modelMapper;

    @Autowired
    private EntityManager entityManager;

    @Override
    public void addCredential(String host, CredentialDto credential) {
        try {

            String finalHost = host.toLowerCase().replace("www.","");

            HostEntity hostEntity = hostRepository.findById(host).orElseGet(()->{
                HostEntity entity = new HostEntity();
                entity.setName(finalHost);
                return hostRepository.save(entity);
            });

            List<PasswordManagerEntity> passwordManagerEntities = this.passwordManagerRepository
                    .findAllByHostNameAndUserEntityUserId(finalHost, this.userService.getUserIdFromToken());
            PasswordManagerEntity passwordManagerEntity;
            CredentialEntity credentialEntity = this.modelMapper.map(credential, CredentialEntity.class);
            if (passwordManagerEntities == null || passwordManagerEntities.isEmpty()) {
                passwordManagerEntity = new PasswordManagerEntity();
                passwordManagerEntity.setHost(hostEntity);
                credentialEntity.setPasswordManager(passwordManagerEntity);
                passwordManagerEntity.setCredentials(Collections.singletonList(credentialEntity));
                passwordManagerEntity.setUserEntity(this.userService.getUserFromToken());
            } else {
                passwordManagerEntity = passwordManagerEntities.get(0);
                credentialEntity.setPasswordManager(passwordManagerEntity);
                if (passwordManagerEntity.getCredentials() == null) {
                    passwordManagerEntity.setCredentials(Collections.singletonList(credentialEntity));
                } else {
                    List<CredentialEntity> credentialEntities = passwordManagerEntity.getCredentials();
                    if(credentialEntities.stream().filter(credentialEntity1 ->
                        credentialEntity1.getUsername().equalsIgnoreCase(credentialEntity.getUsername())
                    ).toList().isEmpty()){
                        credentialEntities.add(credentialEntity);
                        passwordManagerEntity.setCredentials(credentialEntities);
                    }else{
                        throw new DbWorldException(HttpStatus.BAD_REQUEST, "username is already available under host");
                    }
                }
            }
            this.passwordManagerRepository.save(passwordManagerEntity);
        } catch (Exception ex) {
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    public List<PasswordManagerDto> getPasswordManagerByUser() {
        try {
            List<PasswordManagerDto> passwordManagerDtos = new ArrayList<>();
            List<PasswordManagerEntity> passwordManagerEntities = this.passwordManagerRepository.findAllByUserEntityUserId(this.userService.getUserIdFromToken());
            if (passwordManagerEntities != null && !passwordManagerEntities.isEmpty()) {
                passwordManagerDtos = passwordManagerEntities.stream().map(
                        passwordManagerEntity -> this.modelMapper.map(passwordManagerEntity, PasswordManagerDto.class)
                ).toList();
            }
            return passwordManagerDtos;
        }catch (Exception ex){
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    @Transactional
    public void deletePasswordManagerById(String pmId) {
        try {
            this.passwordManagerRepository.deleteByIdAndUserEntityUserId(pmId, this.userService.getUserIdFromToken());
        }catch (Exception ex){
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    public CredentialDto getCredentialById(String credentialId) {
        try {
            CredentialEntity credentialEntity = this.credentialsRepository.findById(credentialId).orElseThrow(
                    () -> new ResourceNotFoundException("Credentials", "credentialId", credentialId)
            );
            return this.modelMapper.map(credentialEntity, CredentialDto.class);
        }catch (Exception ex){
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    @Transactional
    public void deleteCredentialById(String credentialId) {
        try{
            this.credentialsRepository.deleteByIdAndPasswordManagerUserEntityUserId(credentialId, this.userService.getUserIdFromToken());
        }catch (Exception ex){
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    public PasswordManagerDto updateCredential(String pmId, CredentialDto credential) {
        try {
            PasswordManagerEntity passwordManagerEntity = this.passwordManagerRepository.findByIdAndUserEntityUserIdAndCredentialsId(
                    pmId, this.userService.getUserIdFromToken(), credential.getId()
            ).orElseThrow(
                    () -> new DbWorldException(HttpStatus.BAD_REQUEST, "Password Manager Id or Credential Id is not available under your user.")
            );

            CredentialEntity filteredCredential = passwordManagerEntity.getCredentials().stream().filter(
                    credentialEntity -> credentialEntity.getId().equalsIgnoreCase(credential.getId())
            ).toList().get(0);
            this.modelMapper.map(credential, filteredCredential);

            filteredCredential = this.credentialsRepository.save(filteredCredential);

            return new PasswordManagerDto(
                    passwordManagerEntity.getId(),
                    this.modelMapper.map(passwordManagerEntity.getHost(), HostDto.class),
                    Collections.singletonList(this.modelMapper.map(filteredCredential, CredentialDto.class))
            );
        }catch (Exception ex){
            throw new DbWorldException(ex.getMessage());
        }
    }


    @Override
    public List<String> getAllHosts() {
        try{
            return this.hostRepository.findAll().stream().map(HostEntity::getName).toList();
        }catch (Exception ex){
            throw new DbWorldException(ex.getMessage());
        }
    }

}
