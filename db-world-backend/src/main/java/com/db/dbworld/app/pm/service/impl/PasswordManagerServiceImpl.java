package com.db.dbworld.app.pm.service.impl;

import com.db.dbworld.app.pm.repository.CredentialsRepository;
import com.db.dbworld.app.pm.repository.HostRepository;
import com.db.dbworld.app.pm.repository.PasswordManagerRepository;
import com.db.dbworld.app.pm.entity.CredentialEntity;
import com.db.dbworld.app.pm.entity.HostEntity;
import com.db.dbworld.app.pm.entity.PasswordManagerEntity;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.exception.ResourceNotFoundException;
import com.db.dbworld.app.pm.dto.CredentialDto;
import com.db.dbworld.app.pm.dto.HostDto;
import com.db.dbworld.app.pm.dto.PasswordManagerDto;
import com.db.dbworld.app.pm.service.PasswordManagerService;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.user.service.UserService;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Service
@Transactional
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
    private UserContext userContext;

    @Autowired
    private ModelMapper modelMapper;

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
                    .findAllByHostNameAndUserEntityUserId(finalHost, userContext.userId());
            PasswordManagerEntity passwordManagerEntity;
            CredentialEntity credentialEntity = this.modelMapper.map(credential, CredentialEntity.class);
            if (passwordManagerEntities == null || passwordManagerEntities.isEmpty()) {
                passwordManagerEntity = new PasswordManagerEntity();
                passwordManagerEntity.setHost(hostEntity);
                credentialEntity.setPasswordManager(passwordManagerEntity);
                passwordManagerEntity.setCredentials(Collections.singletonList(credentialEntity));
                passwordManagerEntity.setUserEntity(this.userService.getUserEntityById(userContext.userId()));
            } else {
                passwordManagerEntity = passwordManagerEntities.getFirst();
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
            List<PasswordManagerEntity> passwordManagerEntities = this.passwordManagerRepository.findAllByUserEntityUserId(userContext.userId());
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
            this.passwordManagerRepository.deleteByIdAndUserEntityUserId(pmId, userContext.userId());
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
            this.credentialsRepository.deleteByIdAndPasswordManagerUserEntityUserId(credentialId, userContext.userId());
        }catch (Exception ex){
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    public PasswordManagerDto updateCredential(String pmId, CredentialDto credential) {
        try {
            PasswordManagerEntity passwordManagerEntity = this.passwordManagerRepository.findByIdAndUserEntityUserIdAndCredentialsId(
                    pmId, userContext.userId(), credential.getId()
            ).orElseThrow(
                    () -> new DbWorldException(HttpStatus.BAD_REQUEST, "Password Manager Id or Credential Id is not available under your user.")
            );

            CredentialEntity filteredCredential = passwordManagerEntity.getCredentials().stream().filter(
                    credentialEntity -> credentialEntity.getId().equalsIgnoreCase(credential.getId())
            ).toList().getFirst();
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
