package com.db.dbworld.app.pm.service.impl;

import com.db.dbworld.app.pm.dto.CredentialDto;
import com.db.dbworld.app.pm.dto.PasswordManagerDto;
import com.db.dbworld.app.pm.entity.CredentialEntity;
import com.db.dbworld.app.pm.entity.CredentialType;
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

        // No website is a valid entry (a server, an app, a note): it has no host and sits in a group
        // of its own, found again by its name.
        String finalHost = (host == null || host.isBlank()) ? null : normalizeHost(host);
        prepare(credentialDto, finalHost);

        PasswordManagerEntity pm;
        if (finalHost == null) {
            pm = createNewPasswordManager(null);
        } else {
            HostEntity hostEntity = hostRepository.findById(finalHost)
                    .orElseGet(() -> hostRepository.save(new HostEntity(finalHost)));
            pm = passwordManagerRepository
                    .findAllByHostNameAndUserEntityUserId(finalHost, userContext.userId())
                    .stream()
                    .findFirst()
                    .orElseGet(() -> createNewPasswordManager(hostEntity));
        }

        CredentialEntity credential = mapper.toEntity(credentialDto);
        credential.setPasswordManager(pm);
        if (credential.getCustomFields() != null) {
            credential.getCustomFields().forEach(f -> f.setCredential(credential));
        }

        if (pm.getCredentials() == null) {
            pm.setCredentials(new ArrayList<>());
        }

        // Credentials are decrypted when loaded, so the comparison is made here, not in SQL.
        List<CredentialEntity> sameGroup = finalHost != null
                ? pm.getCredentials()
                : passwordManagerRepository.findAllByUserEntityUserId(userContext.userId()).stream()
                        .filter(p -> p.getHost() == null && p.getCredentials() != null)
                        .flatMap(p -> p.getCredentials().stream()).toList();
        boolean exists = sameGroup.stream().anyMatch(c ->
                sameText(c.getUsername(), credential.getUsername())
                        && sameText(displayName(c, finalHost), credential.getName()));

        if (exists) {
            log.warn("Duplicate credential rejected: host={}, name={}, userId={}",
                    finalHost, credential.getName(), userContext.userId());
            throw new DbWorldException(HttpStatus.BAD_REQUEST, finalHost != null
                    ? "You already have this login for " + finalHost
                    : "You already have an entry with this name and username");
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

    /**
     * Fills in what the caller may leave out and rejects what cannot be saved: a type (login by
     * default), a name (the website's host by default) and, except for notes, a username.
     */
    private void prepare(CredentialDto dto, String host) {
        if (dto.getType() == null) dto.setType(CredentialType.LOGIN);
        String name = dto.getName() == null ? "" : dto.getName().trim();
        if (name.isEmpty()) name = host == null ? "" : host;
        if (name.isEmpty()) throw new DbWorldException(HttpStatus.BAD_REQUEST, "Name is required");
        dto.setName(name);
        requireUsername(dto);
    }

    private void requireUsername(CredentialDto dto) {
        boolean blank = dto.getUsername() == null || dto.getUsername().isBlank();
        if (blank && dto.getType() != CredentialType.NOTE) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Username is required");
        }
    }

    /** Entries saved before names existed show their host. */
    private static String displayName(CredentialEntity c, String host) {
        return c.getName() != null && !c.getName().isBlank() ? c.getName() : host;
    }

    /** Case-insensitive, with null and blank the same. */
    private static boolean sameText(String a, String b) {
        return (a == null ? "" : a.trim()).equalsIgnoreCase(b == null ? "" : b.trim());
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

        // An older client may not send these: keep what is stored instead of wiping it.
        if (credentialDto.getName() == null || credentialDto.getName().isBlank()) {
            credentialDto.setName(credential.getName());
        }
        if (credentialDto.getType() == null) {
            credentialDto.setType(credential.getType() == null ? CredentialType.LOGIN : credential.getType());
        }
        requireUsername(credentialDto);

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