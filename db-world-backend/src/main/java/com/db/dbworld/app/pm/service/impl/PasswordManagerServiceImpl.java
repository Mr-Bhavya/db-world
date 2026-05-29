package com.db.dbworld.app.pm.service.impl;

import com.db.dbworld.app.pm.dto.CredentialDto;
import com.db.dbworld.app.pm.dto.HostDto;
import com.db.dbworld.app.pm.dto.PasswordManagerDto;
import com.db.dbworld.app.pm.entity.CredentialEntity;
import com.db.dbworld.app.pm.entity.HostEntity;
import com.db.dbworld.app.pm.entity.PasswordManagerEntity;
import com.db.dbworld.app.pm.mapper.PasswordManagerMapper;
import com.db.dbworld.app.pm.repository.CredentialsRepository;
import com.db.dbworld.app.pm.repository.HostRepository;
import com.db.dbworld.app.pm.repository.PasswordManagerRepository;
import com.db.dbworld.app.pm.service.PasswordManagerService;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.exception.ResourceNotFoundException;
import com.db.dbworld.core.user.service.UserService;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@Transactional
@Log4j2
@RequiredArgsConstructor
public class PasswordManagerServiceImpl implements PasswordManagerService {

    private final PasswordManagerRepository passwordManagerRepository;
    private final HostRepository hostRepository;
    private final CredentialsRepository credentialsRepository;
    private final UserService userService;
    private final UserContext userContext;
    private final PasswordManagerMapper mapper;

    // ─────────────────────────────────────────────
    // ADD CREDENTIAL
    // ─────────────────────────────────────────────
    @Override
    public void addCredential(String host, CredentialDto credentialDto) {
        // PII rule: never log credentialDto.password — only host + username.
        log.debug("addCredential: host={}, username={}", host, credentialDto.getUsername());

        String finalHost = normalizeHost(host);

        HostEntity hostEntity = hostRepository.findById(finalHost)
                .orElseGet(() -> hostRepository.save(new HostEntity(finalHost)));

        PasswordManagerEntity pm = passwordManagerRepository
                .findAllByHostNameAndUserEntityUserId(finalHost, userContext.userId())
                .stream()
                .findFirst()
                .orElseGet(() -> createNewPasswordManager(hostEntity));

        CredentialEntity credential = mapper.toEntity(credentialDto);
        credential.setPasswordManager(pm);
        if (credential.getCustomFields() != null) {
            credential.getCustomFields().forEach(f -> f.setCredential(credential));
        }

        if (pm.getCredentials() == null) {
            pm.setCredentials(new ArrayList<>());
        }

        boolean exists = pm.getCredentials().stream()
                .anyMatch(c -> c.getUsername().equalsIgnoreCase(credential.getUsername()));

        if (exists) {
            log.warn("Duplicate credential rejected: host={}, username={}, userId={}",
                    finalHost, credential.getUsername(), userContext.userId());
            throw new DbWorldException(HttpStatus.BAD_REQUEST,
                    "Username already exists for this host");
        }

        pm.getCredentials().add(credential);

        passwordManagerRepository.save(pm);
        log.info("Credential added: host={}, username={}, userId={}",
                finalHost, credential.getUsername(), userContext.userId());
    }

    private PasswordManagerEntity createNewPasswordManager(HostEntity host) {
        PasswordManagerEntity entity = new PasswordManagerEntity();
        entity.setHost(host);
        entity.setUserEntity(userService.getUserEntityById(userContext.userId()));
        entity.setCredentials(new ArrayList<>());
        return entity;
    }

    private String normalizeHost(String host) {
        return host.toLowerCase().replace("www.", "").trim();
    }

    // ─────────────────────────────────────────────
    // GET ALL
    // ─────────────────────────────────────────────
    @Override
    @Transactional(readOnly = false)
    public List<PasswordManagerDto> getPasswordManagerByUser() {

        List<PasswordManagerEntity> entities =
                passwordManagerRepository.findAllByUserEntityUserId(userContext.userId());

        return mapper.toDtoList(entities);
    }

    // ─────────────────────────────────────────────
    // DELETE PM
    // ─────────────────────────────────────────────
    @Override
    public void deletePasswordManagerById(String pmId) {
        log.info("Deleting password manager: pmId={}, userId={}", pmId, userContext.userId());
        passwordManagerRepository.deleteByIdAndUserEntityUserId(pmId, userContext.userId());
    }

    // ─────────────────────────────────────────────
    // GET CREDENTIAL
    // ─────────────────────────────────────────────
    @Override
    @Transactional
    public CredentialDto getCredentialById(String credentialId) {
        // INFO, not DEBUG: decrypting a credential is an audit-worthy event.
        // We log the id only — never the decrypted password.
        log.info("Credential read: credentialId={}, userId={}", credentialId, userContext.userId());

        CredentialEntity entity = credentialsRepository.findById(credentialId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Credentials", "credentialId", credentialId
                ));

        return mapper.toDto(entity);
    }

    // ─────────────────────────────────────────────
    // DELETE CREDENTIAL
    // ─────────────────────────────────────────────
    @Override
    public void deleteCredentialById(String credentialId) {
        log.info("Deleting credential: credentialId={}, userId={}", credentialId, userContext.userId());
        credentialsRepository.deleteByIdAndPasswordManagerUserEntityUserId(
                credentialId, userContext.userId()
        );
    }

    // ─────────────────────────────────────────────
    // UPDATE CREDENTIAL
    // ─────────────────────────────────────────────
    @Override
    public PasswordManagerDto updateCredential(String pmId, CredentialDto credentialDto) {
        log.debug("updateCredential: pmId={}, credentialId={}", pmId, credentialDto.getId());

        PasswordManagerEntity pm = passwordManagerRepository
                .findByIdAndUserEntityUserIdAndCredentialsId(
                        pmId, userContext.userId(), credentialDto.getId()
                )
                .orElseThrow(() -> new DbWorldException(
                        HttpStatus.BAD_REQUEST,
                        "Invalid PasswordManager or Credential"
                ));

        CredentialEntity credential = pm.getCredentials().stream()
                .filter(c -> c.getId().equalsIgnoreCase(credentialDto.getId()))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Credential", "id", credentialDto.getId()
                ));

        mapper.updateEntityFromDto(credentialDto, credential);

        // Replace custom fields: clear and re-add so orphanRemoval triggers
        credential.getCustomFields().clear();
        if (credentialDto.getCustomFields() != null) {
            credentialDto.getCustomFields().forEach(f -> {
                var entity = mapper.toEntity(f);
                entity.setCredential(credential);
                credential.getCustomFields().add(entity);
            });
        }

        credentialsRepository.save(credential);
        log.info("Credential updated: pmId={}, credentialId={}, userId={}",
                pmId, credential.getId(), userContext.userId());

        return new PasswordManagerDto(
                pm.getId(),
                mapper.toDto(pm.getHost()),
                List.of(mapper.toDto(credential))
        );
    }

    // ─────────────────────────────────────────────
    // GET HOSTS
    // ─────────────────────────────────────────────
    @Override
    public List<String> getAllHosts() {
        return hostRepository.findAll()
                .stream()
                .map(HostEntity::getName)
                .toList();
    }
}