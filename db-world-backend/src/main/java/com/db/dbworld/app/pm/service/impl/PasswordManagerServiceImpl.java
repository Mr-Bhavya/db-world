package com.db.dbworld.app.pm.service.impl;

import com.db.dbworld.app.pm.dto.CredentialDto;
import com.db.dbworld.app.pm.dto.CustomFieldDto;
import com.db.dbworld.app.pm.dto.PasswordHistoryDto;
import com.db.dbworld.app.pm.dto.PasswordManagerDto;
import com.db.dbworld.app.pm.entity.CredentialEntity;
import com.db.dbworld.app.pm.entity.CredentialHistoryEntity;
import com.db.dbworld.app.pm.entity.CredentialType;
import com.db.dbworld.app.pm.entity.CustomFieldType;
import com.db.dbworld.app.pm.entity.HostEntity;
import com.db.dbworld.app.pm.entity.PasswordManagerEntity;
import com.db.dbworld.app.pm.mapper.PasswordManagerMapper;
import com.db.dbworld.app.pm.repository.CredentialHistoryRepository;
import com.db.dbworld.app.pm.repository.CredentialsRepository;
import com.db.dbworld.app.pm.repository.HostRepository;
import com.db.dbworld.app.pm.repository.PasswordManagerRepository;
import com.db.dbworld.app.pm.service.PasswordManagerService;
import com.db.dbworld.app.pm.util.SiteUrl;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.exception.ResourceNotFoundException;
import com.db.dbworld.core.user.service.UserService;

import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.MalformedURLException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@Transactional
@Log4j2
public class PasswordManagerServiceImpl implements PasswordManagerService {

    private final PasswordManagerRepository passwordManagerRepository;
    private final HostRepository hostRepository;
    private final CredentialsRepository credentialsRepository;
    private final CredentialHistoryRepository historyRepository;
    private final UserService userService;
    private final UserContext userContext;
    private final PasswordManagerMapper mapper;
    private final Clock clock;

    @Autowired
    public PasswordManagerServiceImpl(PasswordManagerRepository passwordManagerRepository,
                                      HostRepository hostRepository,
                                      CredentialsRepository credentialsRepository,
                                      CredentialHistoryRepository historyRepository,
                                      UserService userService,
                                      UserContext userContext,
                                      PasswordManagerMapper mapper) {
        this(passwordManagerRepository, hostRepository, credentialsRepository, historyRepository, userService,
                userContext, mapper, Clock.systemUTC());
    }

    /** The clock stamps when an entry was trashed; tests pass a fixed one. */
    public PasswordManagerServiceImpl(PasswordManagerRepository passwordManagerRepository,
                                      HostRepository hostRepository,
                                      CredentialsRepository credentialsRepository,
                                      CredentialHistoryRepository historyRepository,
                                      UserService userService,
                                      UserContext userContext,
                                      PasswordManagerMapper mapper,
                                      Clock clock) {
        this.passwordManagerRepository = passwordManagerRepository;
        this.hostRepository = hostRepository;
        this.credentialsRepository = credentialsRepository;
        this.historyRepository = historyRepository;
        this.userService = userService;
        this.userContext = userContext;
        this.mapper = mapper;
        this.clock = clock;
    }

    // ─────────────────────────────────────────────
    // ADD CREDENTIAL
    // ─────────────────────────────────────────────
    @Override
    public void addCredential(String host, CredentialDto credentialDto) {
        // PII rule: never log credentialDto.password — only host + username.
        log.debug("addCredential: host={}, username={}", host, credentialDto.getUsername());
        validateSizes(credentialDto);

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

        if (hasLiveDuplicate(finalHost, credential.getUsername(), credential.getName(), null)) {
            log.warn("Duplicate credential rejected: host={}, name={}, userId={}",
                    finalHost, credential.getName(), userContext.userId());
            throw new DbWorldException(HttpStatus.BAD_REQUEST, duplicateMessage(finalHost));
        }

        pm.getCredentials().add(credential);

        passwordManagerRepository.save(pm);
        log.info("Credential added: host={}, username={}, userId={}",
                finalHost, credential.getUsername(), userContext.userId());
    }

    /**
     * Same name and username as another LIVE entry, among entries on the same site, or among entries
     * with no site. Compared here, not in SQL, because the values are encrypted at rest. Entries in
     * Trash never count: they are out of the vault, and restoring one runs this same rule.
     *
     * @param ignoreId an entry to leave out of the comparison (the one being edited or restored)
     */
    private boolean hasLiveDuplicate(String host, String username, String name, String ignoreId) {
        List<CredentialEntity> group = host != null
                ? passwordManagerRepository.findAllByHostNameAndUserEntityUserId(host, userContext.userId()).stream()
                        .filter(p -> p.getCredentials() != null)
                        .flatMap(p -> p.getCredentials().stream()).toList()
                : passwordManagerRepository.findAllByUserEntityUserId(userContext.userId()).stream()
                        .filter(p -> p.getHost() == null && p.getCredentials() != null)
                        .flatMap(p -> p.getCredentials().stream()).toList();
        return group.stream().anyMatch(c ->
                c.getDeletedAt() == null
                        && (ignoreId == null || !ignoreId.equals(c.getId()))
                        && sameText(c.getUsername(), username)
                        && sameText(displayName(c, host), name));
    }

    private static String duplicateMessage(String host) {
        return host != null
                ? "You already have this login for " + host
                : "You already have an entry with this name and username";
    }

    private void checkNotDuplicate(String host, CredentialDto dto, String ignoreId) {
        if (hasLiveDuplicate(host, dto.getUsername(), dto.getName(), ignoreId)) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, duplicateMessage(host));
        }
    }

    /** Moves an entry to the group of its new site (or to a group of its own when it has none). */
    private PasswordManagerEntity moveTo(PasswordManagerEntity from, CredentialEntity credential, String host) {
        PasswordManagerEntity to;
        if (host == null) {
            to = createNewPasswordManager(null);
        } else {
            HostEntity hostEntity = hostRepository.findById(host)
                    .orElseGet(() -> hostRepository.save(new HostEntity(host)));
            to = passwordManagerRepository.findAllByHostNameAndUserEntityUserId(host, userContext.userId())
                    .stream().findFirst().orElseGet(() -> createNewPasswordManager(hostEntity));
        }
        from.getCredentials().removeIf(c -> Objects.equals(c.getId(), credential.getId()));
        credential.setPasswordManager(to);
        if (to.getCredentials() == null) to.setCredentials(new ArrayList<>());
        to.getCredentials().add(credential);
        passwordManagerRepository.save(to);
        if (from.getCredentials().isEmpty()) passwordManagerRepository.delete(from);
        log.info("Credential moved: credentialId={}, from={}, to={}", credential.getId(),
                from.getHost() == null ? "(no site)" : from.getHost().getName(), host == null ? "(no site)" : host);
        return to;
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

    /** Longest password, in characters (a LONGTEXT column: this is a sanity cap, not a column size). */
    static final int MAX_PASSWORD_CHARS = 4096;
    /** Longest note or custom-field value, in characters (a private key is a few KB). */
    static final int MAX_TEXT_CHARS = 65536;
    /** Most custom fields on one entry. */
    static final int MAX_CUSTOM_FIELDS = 30;

    // The three columns below are encrypted, and their ciphertext is much longer than the text:
    // AES via CryptoProvider is "AES:" + base64(salt + IV + CBC ciphertext padded to 16 bytes), which
    // measured as 68 chars for up to 15 plaintext bytes, +24 chars per further 16 bytes (192 -> 324,
    // 128 -> 240). The longest plaintext that still fits is 143 UTF-8 bytes in a 255 column and 335
    // in a 512 column. The limits sit on the block boundary below those, 15 / 16 bytes short of the
    // column, so a small change of the ciphertext format does not turn into a 500 from MySQL.
    // Counted in bytes because a character takes up to 4 of them. VaultColumnLimitsJpaTest checks
    // these against the real columns.
    /** Longest PIN, in UTF-8 bytes (the column is 255 chars of ciphertext: 128 bytes -> 240 chars). */
    public static final int MAX_PIN_BYTES = 128;
    /** Longest entry name, in UTF-8 bytes (the column is 512 chars of ciphertext: 320 bytes -> 496 chars). */
    public static final int MAX_NAME_BYTES = 320;
    /** Longest username, in UTF-8 bytes (the column is 512 chars of ciphertext: 320 bytes -> 496 chars). */
    public static final int MAX_USERNAME_BYTES = 320;
    /** Longest custom-field name, in characters. Not encrypted: the column is a plain VARCHAR(255). */
    public static final int MAX_FIELD_KEY_CHARS = 255;

    /**
     * Rejects what is too big to store: the sanity caps on the long text columns and the real size of
     * the short encrypted ones. A null value is fine (older rows and clients). The message names the
     * field, and for a custom field its key, never a value.
     */
    private static void validateSizes(CredentialDto dto) {
        requireMax("Password", dto.getPassword(), MAX_PASSWORD_CHARS);
        requireMaxBytes("PIN", dto.getPin(), MAX_PIN_BYTES);
        requireMaxBytes("Name", dto.getName(), MAX_NAME_BYTES);
        requireMaxBytes("Username", dto.getUsername(), MAX_USERNAME_BYTES);
        requireMax("Notes", dto.getNotes(), MAX_TEXT_CHARS);
        List<CustomFieldDto> fields = dto.getCustomFields();
        if (fields == null) return;
        if (fields.size() > MAX_CUSTOM_FIELDS) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Too many custom fields (max " + MAX_CUSTOM_FIELDS + ")");
        }
        for (CustomFieldDto f : fields) {
            if (f.getFieldKey() == null) {   // the column is NOT NULL: this would be a 500 from the database
                throw new DbWorldException(HttpStatus.BAD_REQUEST, "Custom field name is required");
            }
            requireMax("Custom field name", f.getFieldKey(), MAX_FIELD_KEY_CHARS);
            requireMax("Custom field '" + shortKey(f.getFieldKey()) + "'", f.getFieldValue(), MAX_TEXT_CHARS);
        }
    }

    private static void requireMaxBytes(String what, String value, int maxBytes) {
        // A char is at least one byte, so a value over the limit in chars is over it in bytes too.
        if (value != null && (value.length() > maxBytes || value.getBytes(StandardCharsets.UTF_8).length > maxBytes)) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, what + " is too long (max " + maxBytes + " bytes)");
        }
    }

    private static void requireMax(String what, String value, int max) {
        if (value != null && value.length() > max) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, what + " is too long (max " + max + ")");
        }
    }

    /** A field's key as shown in an error: it is the user's own label, but not worth echoing at any length. */
    private static String shortKey(String key) {
        if (key == null) return "";
        return key.length() <= 60 ? key : key.substring(0, 60) + "...";
    }

    /**
     * Fills in what the caller may leave out and rejects what cannot be saved: a type (login by
     * default), a name (the website's host by default) and, except for notes, a username.
     */
    private void prepare(CredentialDto dto, String host) {
        if (dto.getType() == null) dto.setType(CredentialType.LOGIN);
        if (dto.getCustomFields() != null) {
            dto.getCustomFields().stream().filter(f -> f.getFieldType() == null)
                    .forEach(f -> f.setFieldType(CustomFieldType.HIDDEN));
        }
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
        return groupsOf(false);
    }

    @Override
    public List<PasswordManagerDto> listTrash() {
        return groupsOf(true);
    }

    /**
     * The user's groups, each holding only its live entries (the vault) or only its trashed ones
     * (the Trash). A group with nothing of the wanted kind is left out. Built as new DTOs: the
     * entities are not touched, so nothing here can be flushed back as a change.
     */
    private List<PasswordManagerDto> groupsOf(boolean trashed) {
        return passwordManagerRepository.findAllByUserEntityUserId(userContext.userId()).stream()
                .map(pm -> {
                    List<CredentialEntity> wanted = pm.getCredentials() == null ? List.of()
                            : pm.getCredentials().stream().filter(c -> (c.getDeletedAt() != null) == trashed).toList();
                    return wanted.isEmpty() ? null
                            : new PasswordManagerDto(pm.getId(), mapper.toDto(pm.getHost()),
                                    wanted.stream().map(mapper::toDto).toList());
                })
                .filter(Objects::nonNull)
                .toList();
    }

    // ─────────────────────────────────────────────
    // TRASH A SITE
    // ─────────────────────────────────────────────
    @Override
    public void trashPasswordManager(String pmId) {
        PasswordManagerEntity pm = passwordManagerRepository
                .findByIdAndUserEntityUserId(pmId, userContext.userId())
                .orElseThrow(() -> new ResourceNotFoundException("PasswordManager", "id", pmId));
        Instant now = clock.instant();
        int trashed = 0;
        if (pm.getCredentials() != null) {
            for (CredentialEntity c : pm.getCredentials()) {
                if (c.getDeletedAt() == null) {   // one already in Trash keeps its original time
                    c.setDeletedAt(now);
                    trashed++;
                }
            }
        }
        log.info("Password manager trashed: pmId={}, credentials={}, userId={}", pmId, trashed, userContext.userId());
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

        CredentialEntity entity = credentialsRepository
                .findByIdAndPasswordManagerUserEntityUserId(credentialId, userContext.userId())
                .filter(c -> c.getDeletedAt() == null)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Credentials", "credentialId", credentialId
                ));

        return mapper.toDto(entity);
    }

    // ─────────────────────────────────────────────
    // TRASH
    // ─────────────────────────────────────────────

    /** The caller's own entry, live or trashed. Another user's id is "not found", never acted on. */
    private CredentialEntity ownCredential(String credentialId) {
        return credentialsRepository
                .findByIdAndPasswordManagerUserEntityUserId(credentialId, userContext.userId())
                .orElseThrow(() -> new ResourceNotFoundException("Credentials", "credentialId", credentialId));
    }

    @Override
    public void trashCredential(String credentialId) {
        CredentialEntity credential = ownCredential(credentialId);
        if (credential.getDeletedAt() == null) {
            credential.setDeletedAt(clock.instant());
        }
        log.info("Credential trashed: credentialId={}, userId={}", credentialId, userContext.userId());
    }

    @Override
    public void restore(String credentialId) {
        CredentialEntity credential = ownCredential(credentialId);
        if (credential.getDeletedAt() == null) return;   // already back in the vault

        PasswordManagerEntity pm = credential.getPasswordManager();
        String host = pm.getHost() == null ? null : pm.getHost().getName();
        if (hasLiveDuplicate(host, credential.getUsername(), displayName(credential, host), credentialId)) {
            log.warn("Restore refused, a live duplicate exists: credentialId={}, host={}, userId={}",
                    credentialId, host, userContext.userId());
            throw new DbWorldException(HttpStatus.CONFLICT,
                    duplicateMessage(host) + ". Rename or delete it before restoring this one.");
        }
        credential.setDeletedAt(null);
        log.info("Credential restored: credentialId={}, userId={}", credentialId, userContext.userId());
    }

    @Override
    public void purge(String credentialId) {
        CredentialEntity credential = ownCredential(credentialId);
        if (credential.getDeletedAt() == null) {
            // "Delete forever" is for entries already in Trash: a live one is trashed first.
            throw new ResourceNotFoundException("Trashed credential", "credentialId", credentialId);
        }
        removeForGood(credential);
        log.info("Credential purged: credentialId={}, userId={}", credentialId, userContext.userId());
    }

    @Override
    public int purgeTrashedBefore(Instant cutoff) {
        List<CredentialEntity> expired = credentialsRepository.findAllByDeletedAtBefore(cutoff);
        expired.forEach(this::removeForGood);
        log.info("Trash purge: removed={}, cutoff={}", expired.size(), cutoff);
        return expired.size();
    }

    /**
     * How an entry leaves the database when the vault removes it: "Delete forever" and the daily
     * purge both end here, so whatever must go with an entry (its history) is removed in one place.
     * A group left with no entries goes too. Deleting a whole account is the other path: it clears
     * the vault with SQL in {@code AccountDeletionService}, which must delete the same child rows.
     */
    private void removeForGood(CredentialEntity credential) {
        PasswordManagerEntity pm = credential.getPasswordManager();
        if (pm != null && pm.getCredentials() != null) {
            pm.getCredentials().removeIf(c -> Objects.equals(c.getId(), credential.getId()));
        }
        // History first, in its own statement: its rows point at the entry, so the entry cannot go before them.
        historyRepository.deleteByCredentialId(credential.getId());
        credentialsRepository.delete(credential);
        if (pm != null && (pm.getCredentials() == null || pm.getCredentials().isEmpty())) {
            passwordManagerRepository.delete(pm);
        }
    }

    // ─────────────────────────────────────────────
    // PASSWORD HISTORY
    // ─────────────────────────────────────────────
    /** How many earlier passwords an entry keeps. */
    private static final int HISTORY_LIMIT = 5;

    /** The caller's own LIVE entry. An entry in Trash has no reachable history: it is "not found". */
    private CredentialEntity ownLiveCredential(String credentialId) {
        CredentialEntity credential = ownCredential(credentialId);
        if (credential.getDeletedAt() != null) {
            throw new ResourceNotFoundException("Credentials", "credentialId", credentialId);
        }
        return credential;
    }

    @Override
    public List<PasswordHistoryDto> getHistory(String credentialId) {
        CredentialEntity credential = ownLiveCredential(credentialId);
        // INFO like getCredentialById: old passwords are decrypted and returned. Ids only.
        log.info("Password history read: credentialId={}, userId={}", credentialId, userContext.userId());
        return historyRepository.findAllByCredentialIdOrderByChangedAtDescIdDesc(credential.getId()).stream()
                .limit(HISTORY_LIMIT)
                .map(mapper::toDto)
                .toList();
    }

    @Override
    public void restorePassword(String credentialId, String historyId) {
        CredentialEntity credential = ownLiveCredential(credentialId);
        CredentialHistoryEntity row = historyRepository.findByIdAndCredentialId(historyId, credential.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Password history", "historyId", historyId));

        String current = credential.getPassword();
        credential.setPassword(row.getPassword());
        historyRepository.delete(row);          // the restored row is used up...
        recordHistory(credential, current);     // ...and the password it replaced takes its place
        log.info("Password restored from history: credentialId={}, historyId={}, userId={}",
                credentialId, historyId, userContext.userId());
    }

    /**
     * Keeps a password the entry no longer uses, then drops the oldest rows beyond the limit. A blank
     * password is not worth keeping.
     */
    private void recordHistory(CredentialEntity credential, String oldPassword) {
        if (oldPassword == null || oldPassword.isBlank()) return;
        historyRepository.save(new CredentialHistoryEntity(credential, oldPassword, clock.instant()));
        List<CredentialHistoryEntity> rows = historyRepository.findAllByCredentialIdOrderByChangedAtDescIdDesc(credential.getId());
        if (rows.size() > HISTORY_LIMIT) {
            historyRepository.deleteAll(rows.subList(HISTORY_LIMIT, rows.size()));
        }
    }

    // ─────────────────────────────────────────────
    // UPDATE CREDENTIAL
    // ─────────────────────────────────────────────
    @Override
    public PasswordManagerDto updateCredential(String pmId, CredentialDto credentialDto) {
        log.debug("updateCredential: pmId={}, credentialId={}", pmId, credentialDto.getId());
        validateSizes(credentialDto);   // before anything is read or changed: a rejected request touches nothing

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
                // A trashed entry cannot be edited: it is restored first.
                .filter(c -> c.getDeletedAt() == null)
                .orElseThrow(() -> new DbWorldException(
                        HttpStatus.BAD_REQUEST,
                        "Invalid PasswordManager or Credential"
                ));

        // An older client may not send these: keep what is stored instead of wiping it.
        if (credentialDto.getName() == null || credentialDto.getName().isBlank()) {
            credentialDto.setName(credential.getName());
        }
        if (credentialDto.getType() == null) {
            credentialDto.setType(credential.getType() == null ? CredentialType.LOGIN : credential.getType());
        }
        String currentHost = pm.getHost() == null ? null : pm.getHost().getName();
        if (credentialDto.getName() == null || credentialDto.getName().isBlank()) {
            credentialDto.setName(currentHost);   // an entry that never had a name is named after its site
        }
        if (credentialDto.getName() == null || credentialDto.getName().isBlank()) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Name is required");
        }
        requireUsername(credentialDto);

        // The website: null leaves it alone, blank removes it, anything else moves the entry.
        String targetHost = currentHost;
        if (credentialDto.getUrl() != null) {
            try {
                String h = SiteUrl.hostOf(credentialDto.getUrl());
                targetHost = h == null ? null : normalizeHost(h);
            } catch (MalformedURLException ex) {
                throw new DbWorldException(HttpStatus.BAD_REQUEST, "Invalid website: " + credentialDto.getUrl());
            }
        }
        checkNotDuplicate(targetHost, credentialDto, credential.getId());

        // An older client sends no type: a field it sends back keeps the type it had (HIDDEN if none).
        // Read before updateEntityFromDto, which overwrites the stored fields.
        Map<String, CustomFieldType> storedTypes = new HashMap<>();
        credential.getCustomFields().stream().filter(f -> f.getId() != null && f.getFieldType() != null)
                .forEach(f -> storedTypes.put(f.getId(), f.getFieldType()));

        String newUrl = credentialDto.getUrl();
        String oldPassword = credential.getPassword();   // read before the mapper overwrites it
        mapper.updateEntityFromDto(credentialDto, credential);
        if (!Objects.equals(oldPassword, credential.getPassword())) {
            recordHistory(credential, oldPassword);
        }
        if (newUrl != null) credential.setUrl(newUrl.isBlank() ? null : newUrl);

        if (!Objects.equals(targetHost, currentHost)) {
            pm = moveTo(pm, credential, targetHost);
        }

        // Replace custom fields: clear and re-add so orphanRemoval triggers
        credential.getCustomFields().clear();
        if (credentialDto.getCustomFields() != null) {
            credentialDto.getCustomFields().forEach(f -> {
                if (f.getFieldType() == null) {
                    f.setFieldType(storedTypes.getOrDefault(f.getId(), CustomFieldType.HIDDEN));
                }
                var entity = mapper.toEntity(f);
                entity.setCredential(credential);
                credential.getCustomFields().add(entity);
            });
        }

        credentialsRepository.save(credential);
        log.info("Credential updated: pmId={}, credentialId={}, userId={}",
                pm.getId(), credential.getId(), userContext.userId());

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