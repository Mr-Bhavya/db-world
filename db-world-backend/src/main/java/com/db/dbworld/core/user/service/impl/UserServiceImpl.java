package com.db.dbworld.core.user.service.impl;

import com.db.dbworld.audit.activity.entity.LoginDataEntity;
import com.db.dbworld.audit.activity.repository.LoginDataRepository;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.exception.ResourceNotFoundException;
import com.db.dbworld.core.role.entity.RoleEntity;
import com.db.dbworld.core.role.enums.Role;
import com.db.dbworld.core.role.repository.UserRoleRepository;
import com.db.dbworld.core.user.dto.*;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.enums.Gender;
import com.db.dbworld.core.user.mapper.UserMapper;
import com.db.dbworld.core.user.repository.UserRepository;
import com.db.dbworld.core.user.service.AccountDeletionService;
import com.db.dbworld.core.user.service.UserService;
import com.db.dbworld.security.auth.SessionRevocationService;
import com.db.dbworld.security.entity.RefreshTokenEntity.RevokeReason;
import com.db.dbworld.security.entity.RefreshTokenEntity;
import com.db.dbworld.security.entity.BiometricDeviceEntity;
import com.db.dbworld.security.repository.RefreshTokenRepository;
import com.db.dbworld.security.repository.BiometricDeviceRepository;

import com.db.dbworld.config.AppConstants;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.Set;
import java.util.stream.Collectors;

@Log4j2
@Service
@Transactional
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final UserRoleRepository roleRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final UserContext userContext;
    private final LoginDataRepository loginDataRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final BiometricDeviceRepository biometricDeviceRepository;
    private final SessionRevocationService sessionRevocationService;
    private final AccountDeletionService accountDeletionService;

    // ==============================
    // âœ… CREATE USER
    // ==============================
    @Override
    public UserDto createUser(CreateUserRequest request) {
        log.debug("createUser called for email={} (roleId={})", request.getEmail(), request.getRoleId());

        UserEntity entity = userMapper.toEntity(request);

        entity.setGender(Gender.normalize(entity.getGender()));
        entity.setPassword(passwordEncoder.encode(request.getPassword()));

        RoleEntity role;
        if (request.getRoleId() != null) {
            role = roleRepository.findById(Math.toIntExact(request.getRoleId()))
                    .orElseThrow(() -> {
                        log.warn("createUser: role not found by id {} for email={}",
                                request.getRoleId(), request.getEmail());
                        return new ResourceNotFoundException("Role", "id", request.getRoleId());
                    });
        } else {
            role = roleRepository.findByName(Role.VIEWER);
            if (role == null) {
                log.error("createUser: default VIEWER role missing — initialization broken");
                throw new ResourceNotFoundException("Role", "name", Role.VIEWER.name());
            }
        }

        entity.setRole(role);

        UserEntity saved = userRepository.save(entity);
        log.info("Created user [{}] (id={}, role={})",
                saved.getEmail(), saved.getUserId(), role.getName().name());
        return userMapper.toDto(saved);
    }

    @Override
    public List<UserDto> createUsers(List<CreateUserRequest> requests) {

        if (requests == null || requests.isEmpty()) {
            log.debug("createUsers called with empty/null list");
            return List.of();
        }

        log.info("Bulk createUsers requested for {} accounts", requests.size());
        return requests.stream()
                .map(this::createUser)
                .toList();
    }

    // ==============================
    // âœ… GET USER
    // ==============================
    @Override
    public UserDto getUserDtoById(Long userId) {
        return userMapper.toDto(getUserEntityById(userId));
    }

    @Override
    public UserEntity getUserEntityById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
    }

    @Override
    public List<UserDto> getAllUsers(Pageable pageable) {
        return userRepository.findAll(pageable)
                .stream()
                .map(entity -> {
                    UserDto dto = userMapper.toDto(entity);
                    Long uid = entity.getUserId();
                    dto.setNoOfLogin(loginDataRepository.totalNumberOfLogin(uid));
                    dto.setLoginData(loginDataRepository.getLoginDataFromUserId(uid)
                            .stream()
                            .map(ld -> {
                                UserDto.LoginData entry = new UserDto.LoginData();
                                entry.setLastLoginDate(ld.getLastLoginDate());
                                entry.setLoginAgent(ld.getLoginAgent());
                                return entry;
                            })
                            .toList());
                    return dto;
                })
                .toList();
    }

    @Override
    public Map<String, Object> getPagedUsers(String search, String role, int page, int size, String sortBy, String sortDir) {
        Set<String> VALID_SORT = Set.of("userId", "firstName", "lastName", "email", "creationDate");
        String safeSort = VALID_SORT.contains(sortBy) ? sortBy : "userId";
        Sort.Direction dir = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, Math.min(size, 100), Sort.by(dir, safeSort));

        Page<UserEntity> entityPage = userRepository.findAll((root, query1, cb) -> {
            List<Predicate> preds = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                String like = "%" + search.toLowerCase() + "%";
                preds.add(cb.or(
                    cb.like(cb.lower(root.get("firstName")), like),
                    cb.like(cb.lower(root.get("lastName")), like),
                    cb.like(cb.lower(root.get("email")), like)
                ));
            }
            if (role != null && !role.isBlank() && !role.equalsIgnoreCase("ALL")) {
                try {
                    Role r = Role.valueOf(role.toUpperCase());
                    preds.add(cb.equal(root.get("role").get("name"), r));
                } catch (IllegalArgumentException ignored) { /* An unknown role name simply contributes no predicate. */ }
            }
            return preds.isEmpty() ? cb.conjunction() : cb.and(preds.toArray(Predicate[]::new));
        }, pageable);

        List<UserDto> content = entityPage.getContent().stream()
            .map(entity -> {
                UserDto dto = userMapper.toDto(entity);
                Long uid = entity.getUserId();
                dto.setNoOfLogin(loginDataRepository.totalNumberOfLogin(uid));
                dto.setLoginData(loginDataRepository.getLoginDataFromUserId(uid)
                    .stream()
                    .map(ld -> {
                        UserDto.LoginData entry = new UserDto.LoginData();
                        entry.setLastLoginDate(ld.getLastLoginDate());
                        entry.setLoginAgent(ld.getLoginAgent());
                        return entry;
                    })
                    .toList());
                return dto;
            })
            .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("content",       content);
        result.put("totalElements", entityPage.getTotalElements());
        result.put("totalPages",    entityPage.getTotalPages());
        result.put("page",          entityPage.getNumber());
        result.put("size",          entityPage.getSize());
        result.put("last",          entityPage.isLast());
        return result;
    }

    @Override
    public List<UserSearchResponse> searchUsers(String query, int limit) {

        if (query == null || query.trim().isEmpty()) {
            return List.of();
        }

        return userRepository.searchUsers(query.trim(), PageRequest.of(0, limit))
                .stream()
                .map(p -> new UserSearchResponse(
                        p.getUserId(),
                        p.getFirstName() + " " + p.getLastName(),
                        p.getEmail()
                ))
                .toList();
    }

    // ==============================
    // âœ… UPDATE USER (NO PASSWORD)
    // ==============================
    @Override
    public UserDto updateUser(UpdateUserRequest request, Long userId) {
        log.debug("updateUser called for userId={}", userId);

        UserEntity entity = getUserEntityById(userId);

        // Email change → enforce uniqueness before the mapper applies it.
        String newEmail = request.getEmail();
        if (newEmail != null && !newEmail.isBlank() && !newEmail.equalsIgnoreCase(entity.getEmail())) {
            userRepository.findByEmail(newEmail).ifPresent(other -> {
                if (other.getUserId() != entity.getUserId()) {
                    log.warn("updateUser rejected: email [{}] already in use", newEmail);
                    throw new DbWorldException("Email already in use");
                }
            });
        }

        userMapper.updateUserFromRequest(request, entity);
        entity.setGender(Gender.normalize(entity.getGender()));

        boolean passwordChanged = request.getPassword() != null && !request.getPassword().isBlank();
        if (passwordChanged) {
            entity.setPassword(passwordEncoder.encode(request.getPassword()));
        }

        UserEntity saved = userRepository.save(entity);
        log.info("Updated user [{}] (id={}, passwordChanged={})",
                saved.getEmail(), userId, passwordChanged);
        return userMapper.toDto(saved);
    }

    // ==============================
    // âœ… CHANGE PASSWORD
    // ==============================
    @Override
    public void changePassword(ChangePasswordRequest request) {
        log.debug("changePassword called");

        UserEntity user = getCurrentUser();

        // A Google-only account has no password to check, so this doubles as "set a password".
        // Requiring an old password it never had would leave those users permanently unable to
        // add one, and they are already authenticated by their access token.
        if (user.hasPassword()) {
            if (!passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
                log.warn("changePassword rejected: invalid old password for user [{}]", user.getEmail());
                throw new DbWorldException(HttpStatus.BAD_REQUEST, "Invalid old password");
            }
        } else {
            log.info("Setting a first password for Google-only account [{}]", user.getEmail());
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));

        userRepository.save(user);
        // A password change signs the account out everywhere: drop all refresh-token sessions and
        // biometric device tokens so a stolen credential (or an old biometric enrollment) can't
        // keep minting access after the password is rotated.
        revokeAllCredentials(user.getUserId(), RevokeReason.PASSWORD_CHANGED);
        log.info("Password changed for user [{}]", user.getEmail());
    }

    // ==============================
    // 🔐 ADMIN RESET PASSWORD
    // ==============================
    @Override
    public void adminSetPassword(Long userId, String newPassword) {
        log.debug("adminSetPassword called for userId={}", userId);
        UserEntity user = getUserEntityById(userId);
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        revokeAllCredentials(userId, RevokeReason.PASSWORD_CHANGED);
        log.warn("Password reset for user [{}] (id={}) by admin [{}]",
                user.getEmail(), userId, userContext.userId());
    }

    /**
     * Revokes every way into the account after a credential change.
     *
     * <p>Delegates so that the access tokens already issued are invalidated too. Deleting the
     * refresh tokens alone used to leave the current access token working for the rest of its
     * TTL, which meant a password reset did not actually lock anyone out straight away.
     */
    private void revokeAllCredentials(Long userId, RevokeReason reason) {
        sessionRevocationService.revokeEverything(userId, reason);
    }

    // ==============================
    // 🔐 SESSIONS (refresh tokens) + login history
    // ==============================
    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getUserSessions(Long userId) {
        getUserEntityById(userId); // validate existence
        Instant now = Instant.now();

        List<RefreshTokenEntity> tokens = refreshTokenRepository.findByUser_UserIdOrderByCreatedDesc(userId);

        // Rotation means one session is many token rows. Collapse them by family so the list
        // shows devices rather than a new entry every time a token was refreshed.
        Map<UUID, List<RefreshTokenEntity>> byFamily = tokens.stream()
                .filter(t -> t.getFamilyId() != null)
                .collect(Collectors.groupingBy(RefreshTokenEntity::getFamilyId,
                        LinkedHashMap::new, Collectors.toList()));

        List<Map<String, Object>> sessions = byFamily.entrySet().stream()
                .map(entry -> {
                    List<RefreshTokenEntity> family = entry.getValue();
                    RefreshTokenEntity newest = family.getFirst();
                    RefreshTokenEntity oldest = family.getLast();
                    boolean active = family.stream().anyMatch(t -> t.isActive(now));

                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", entry.getKey().toString());   // family id — what revoke targets
                    m.put("created", oldest.getCreated());
                    m.put("expiry", newest.getExpiry());
                    m.put("lastUsed", newest.getLastUsed());
                    m.put("refreshCount", newest.getRefreshCount() != null ? newest.getRefreshCount() : 0);
                    m.put("platform", newest.getPlatform() != null ? newest.getPlatform().name() : "WEB");
                    m.put("userAgent", newest.getUserAgent());
                    m.put("ipAddress", newest.getIpAddress());
                    m.put("active", active);
                    m.put("revokedAt", newest.getRevokedAt());
                    m.put("revokedReason", newest.getRevokedReason() != null
                            ? newest.getRevokedReason().name() : null);
                    return m;
                })
                .toList();

        long activeCount = sessions.stream().filter(m -> Boolean.TRUE.equals(m.get("active"))).count();

        List<Map<String, Object>> loginHistory = loginDataRepository.getLoginDataFromUserId(userId).stream()
                .map(ld -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("date", ld.getLastLoginDate());
                    m.put("agent", ld.getLoginAgent());
                    return m;
                })
                .toList();

        List<Map<String, Object>> biometricDevices = biometricDeviceRepository
                .findByUser_UserIdAndRevokedFalseOrderByCreatedDesc(userId).stream()
                .map(d -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("deviceId", d.getDeviceId());
                    m.put("deviceLabel", d.getDeviceLabel());
                    m.put("created", d.getCreated());
                    m.put("lastUsed", d.getLastUsed());
                    m.put("expiry", d.getExpiry());
                    m.put("active", d.getExpiry() != null && d.getExpiry().isAfter(now));
                    return m;
                })
                .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sessions", sessions);
        result.put("activeCount", activeCount);
        result.put("loginHistory", loginHistory);
        result.put("biometricDevices", biometricDevices);
        return result;
    }

    @Override
    public int revokeUserSessions(Long userId) {
        getUserEntityById(userId); // validate existence
        int removed = sessionRevocationService.revokeAll(userId, RevokeReason.ADMIN_REVOKED, null);
        log.warn("Revoked {} sessions for user id={} by admin [{}]",
                removed, userId, userContext.userId());
        return removed;
    }

    // Enable / disable (lock) a user.
    @Override
    public UserDto setUserEnabled(Long userId, boolean enabled) {
        log.debug("setUserEnabled called: userId={} enabled={}", userId, enabled);

        if (!enabled && userId.equals(userContext.userId())) {
            log.warn("setUserEnabled rejected: user [{}] attempted to disable themselves", userId);
            throw new DbWorldException("You cannot disable your own account");
        }

        UserEntity user = getUserEntityById(userId);

        if (!enabled && user.getRole() != null && user.getRole().getName() == Role.ADMIN
                && userRepository.countByRoleName(Role.ADMIN) <= 1) {
            log.warn("setUserEnabled rejected: cannot disable the last ADMIN (userId={})", userId);
            throw new DbWorldException("Cannot disable the last admin user");
        }

        user.setEnabled(enabled);
        UserEntity saved = userRepository.save(user);

        // Disabling revokes sessions so existing refresh tokens can't mint new access
        // tokens; the short-lived access token then expires and the user is locked out.
        if (!enabled) {
            int revoked = sessionRevocationService.revokeAll(
                    userId, RevokeReason.ACCOUNT_DISABLED, null);
            log.warn("User [{}] (id={}) disabled by admin [{}] — revoked {} sessions",
                    saved.getEmail(), userId, userContext.userId(), revoked);
        } else {
            log.info("User [{}] (id={}) enabled by admin [{}]", saved.getEmail(), userId, userContext.userId());
        }
        return userMapper.toDto(saved);
    }

    // ==============================
    // âœ… PROFILE
    // ==============================
    @Override
    public UserDto getUserProfile() {
        return userMapper.toDto(getCurrentUser());
    }

    // ==============================
    // âœ… ROLE
    // ==============================
    @Override
    public String getRoleForUser() {
        return getCurrentUser().getRole().getName().name();
    }

    /**
     * Changes a user's role, and decides what that means for their live sessions.
     *
     * <p>Losing privileges revokes everything immediately: a demoted admin must not keep admin
     * access for the remaining life of an access token they are already holding. Gaining
     * privileges is not a security event, so those sessions are left alone — the token version
     * is untouched and the client simply picks up the new role on its next refresh, without the
     * user being bounced to the login screen for being promoted.
     */
    @Override
    public UserDto updateUserRole(Long userId, Long roleId) {
        log.debug("updateUserRole called: userId={} roleId={}", userId, roleId);

        UserEntity user = getUserEntityById(userId);

        RoleEntity role = roleRepository.findById(Math.toIntExact(roleId))
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", roleId));

        // avoid unnecessary DB update
        if (user.getRole() != null && user.getRole().getId() == role.getId()) {
            log.debug("updateUserRole no-op: user [{}] already has role {}",
                    user.getEmail(), role.getName().name());
            return userMapper.toDto(user);
        }

        Role previous = user.getRole() != null ? user.getRole().getName() : null;
        Role next = role.getName();

        // Removing the last admin would lock everyone out of the console just as surely as
        // deleting them would.
        if (previous != null && isDowngrade(previous, next)
                && (previous == Role.ADMIN || previous == Role.OWNER)
                && userRepository.countByRoleName(previous) <= 1) {
            log.warn("updateUserRole rejected: [{}] is the last {}", user.getEmail(), previous);
            throw new DbWorldException(HttpStatus.CONFLICT,
                    "Cannot change the role of the last " + previous + " account");
        }

        user.setRole(role);
        UserEntity saved = userRepository.save(user);

        if (previous != null && isDowngrade(previous, next)) {
            int revoked = sessionRevocationService.revokeAll(
                    userId, RevokeReason.ROLE_DOWNGRADE, null);
            log.warn("Role DOWNGRADED for user [{}] (id={}): {} to {} — revoked {} sessions",
                    saved.getEmail(), userId, previous, next, revoked);
        } else {
            log.info("Role changed for user [{}] (id={}): {} to {} — sessions kept",
                    saved.getEmail(), userId, previous == null ? "<none>" : previous, next);
        }
        return userMapper.toDto(saved);
    }

    /**
     * True when {@code next} carries fewer privileges than {@code previous}.
     *
     * <p>Ranked explicitly rather than by enum ordinal so that reordering the {@link Role} enum
     * — a harmless-looking edit — cannot quietly invert which changes count as a downgrade.
     */
    private static boolean isDowngrade(Role previous, Role next) {
        return rank(next) < rank(previous);
    }

    private static int rank(Role role) {
        return switch (role) {
            case OWNER -> 3;
            case ADMIN -> 2;
            case VIEWER -> 1;
        };
    }

    // ==============================
    // âœ… DELETE
    // ==============================
    /**
     * Admin deletion. Soft by default — the same 30-day grace window a user gets when they
     * delete their own account, so an admin mis-click on the wrong row does not destroy
     * somebody's wallet and vault outright.
     */
    @Override
    public void deleteUserById(Long userId) {
        log.debug("deleteUserById called for userId={}", userId);

        if (userId.equals(userContext.userId())) {
            log.warn("deleteUserById rejected: user [{}] attempted self-delete", userId);
            throw new DbWorldException(HttpStatus.BAD_REQUEST,
                    "Use the delete-my-account flow to remove your own account");
        }

        Instant purgeAfter = accountDeletionService.softDelete(userId, "admin:" + userContext.userId());
        log.warn("User id={} scheduled for deletion by [{}] — purge at {}",
                userId, userContext.userId(), purgeAfter);
    }

    /** Admin escape hatch: erase the account and its data now, skipping the grace window. */
    @Override
    public void purgeUserById(Long userId) {
        if (userId.equals(userContext.userId())) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "You cannot purge your own account");
        }
        // Runs the soft delete first so the last-admin guard and the credential revocation
        // both apply — purging is meant to skip the WAIT, not the safety checks.
        accountDeletionService.softDelete(userId, "admin-purge:" + userContext.userId());
        accountDeletionService.purge(userId);
        log.warn("User id={} PURGED immediately by admin [{}]", userId, userContext.userId());
    }

    /**
     * Self-service deletion.
     *
     * <p>Re-authentication is required even though the caller already holds a valid access
     * token: this wipes a document wallet holding government IDs and a password vault, so an
     * unattended or stolen session must not be enough on its own. Google-only accounts have no
     * password to re-enter, so typing the account email is what proves intent for them.
     */
    @Override
    public Instant deleteOwnAccount(String password, String confirmEmail) {
        UserEntity user = getCurrentUser();

        if (confirmEmail == null || !user.getEmail().equalsIgnoreCase(confirmEmail.trim())) {
            log.warn("deleteOwnAccount rejected: email confirmation mismatch for [{}]", user.getEmail());
            throw new DbWorldException(HttpStatus.BAD_REQUEST,
                    "Type your account email exactly to confirm deletion");
        }

        if (user.hasPassword()) {
            if (password == null || !passwordEncoder.matches(password, user.getPassword())) {
                log.warn("deleteOwnAccount rejected: bad password for [{}]", user.getEmail());
                throw new DbWorldException(HttpStatus.UNAUTHORIZED, "Incorrect password");
            }
        } else if (!user.hasGoogleLinked()) {
            // No password and no Google identity — there is no way to prove intent, so refuse
            // rather than delete on the strength of the access token alone.
            throw new DbWorldException(HttpStatus.CONFLICT,
                    "This account has no credential to confirm with. Contact an administrator.");
        }

        return accountDeletionService.softDelete(user.getUserId(), "self");
    }

    @Override
    public void restoreDeletedAccount(Long userId) {
        accountDeletionService.restore(userId);
    }

    // ==============================
    // 🔐 ACCOUNT STATE + CREDENTIALS (admin)
    // ==============================

    /** Locks or unlocks an account. Locking revokes sessions the same way disabling does. */
    @Override
    public UserDto setUserLocked(Long userId, boolean locked) {
        if (locked && userId.equals(userContext.userId())) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "You cannot lock your own account");
        }

        UserEntity user = getUserEntityById(userId);

        if (locked && user.getRole() != null
                && (user.getRole().getName() == Role.ADMIN || user.getRole().getName() == Role.OWNER)
                && userRepository.countByRoleName(user.getRole().getName()) <= 1) {
            throw new DbWorldException(HttpStatus.CONFLICT,
                    "Cannot lock the last " + user.getRole().getName() + " account");
        }

        user.setAccountNonLocked(!locked);
        UserEntity saved = userRepository.save(user);

        if (locked) {
            int revoked = sessionRevocationService.revokeAll(userId, RevokeReason.ACCOUNT_LOCKED, null);
            log.warn("User [{}] (id={}) locked by admin [{}] — revoked {} sessions",
                    saved.getEmail(), userId, userContext.userId(), revoked);
        } else {
            log.info("User [{}] (id={}) unlocked by admin [{}]",
                    saved.getEmail(), userId, userContext.userId());
        }
        return userMapper.toDto(saved);
    }

    /**
     * Detaches a Google identity from an account.
     *
     * <p>Refused when it is the only credential left: unlinking then would leave an account
     * nobody — including its owner — could ever sign into again.
     */
    @Override
    public UserDto unlinkGoogle(Long userId) {
        UserEntity user = getUserEntityById(userId);

        if (!user.hasGoogleLinked()) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "This account has no Google identity linked");
        }
        if (!user.hasPassword()) {
            throw new DbWorldException(HttpStatus.CONFLICT,
                    "Google is the only sign-in method on this account. Set a password first.");
        }

        user.setGoogleSub(null);
        user.setAvatarUrl(null);
        UserEntity saved = userRepository.save(user);

        // Google sessions were started by a credential that no longer applies, so they end here.
        sessionRevocationService.revokeAll(userId, RevokeReason.GOOGLE_UNLINKED, null);
        log.warn("Google unlinked from user [{}] (id={}) by [{}]",
                saved.getEmail(), userId, userContext.userId());
        return userMapper.toDto(saved);
    }

    @Override
    public long revokeBiometricDevices(Long userId) {
        getUserEntityById(userId);
        return sessionRevocationService.revokeBiometricDevices(userId);
    }

    @Override
    public long revokePushTokens(Long userId) {
        getUserEntityById(userId);
        return sessionRevocationService.revokePushTokens(userId);
    }

    /** Ends one session (by rotation family) belonging to a user. */
    @Override
    public boolean revokeUserSession(Long userId, UUID familyId) {
        getUserEntityById(userId);
        return sessionRevocationService.revokeFamily(userId, familyId, RevokeReason.ADMIN_REVOKED);
    }

    // ==============================
    // âœ… EMAIL LOOKUP
    // ==============================
    @Override
    public UserDto getUserDtoByEmail(String email) {
        return userMapper.toDto(getUserEntityByEmail(email));
    }

    @Override
    public UserEntity getUserEntityByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    // ==============================
    // âœ… UPDATE DOB
    // ==============================
    @Override
    public void updateDob(Date dob) {
        log.debug("updateDob called: dob={}", dob);
        UserEntity user = getCurrentUser();
        user.setDob(dob);
        userRepository.save(user);
        log.info("DOB updated for user [{}]", user.getEmail());
    }

    // ==============================
    // ðŸ”’ INTERNAL
    // ==============================
    private UserEntity getCurrentUser() {
        return getUserEntityById(userContext.userId());
    }
}