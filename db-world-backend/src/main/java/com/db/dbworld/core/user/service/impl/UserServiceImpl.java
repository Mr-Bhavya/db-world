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
import com.db.dbworld.core.user.service.UserService;
import com.db.dbworld.security.entity.RefreshTokenEntity;
import com.db.dbworld.security.entity.BiometricDeviceEntity;
import com.db.dbworld.security.repository.RefreshTokenRepository;
import com.db.dbworld.security.repository.BiometricDeviceRepository;

import com.db.dbworld.config.AppConstants;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

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
                } catch (IllegalArgumentException ignored) {}
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

        if (!passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
            log.warn("changePassword rejected: invalid old password for user [{}]", user.getEmail());
            throw new DbWorldException("Invalid old password");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));

        userRepository.save(user);
        // A password change signs the account out everywhere: drop all refresh-token sessions and
        // biometric device tokens so a stolen credential (or an old biometric enrollment) can't
        // keep minting access after the password is rotated.
        revokeAllCredentials(user.getUserId());
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
        revokeAllCredentials(userId);
        log.warn("Password reset for user [{}] (id={}) by admin [{}]",
                user.getEmail(), userId, userContext.userId());
    }

    /** Revokes every session + biometric device for a user (used on password change / admin reset). */
    private void revokeAllCredentials(Long userId) {
        long sessions = refreshTokenRepository.deleteByUser_UserId(userId);
        long devices  = biometricDeviceRepository.deleteByUser_UserId(userId);
        log.info("Revoked {} session(s) and {} biometric device(s) for user id={}", sessions, devices, userId);
    }

    // ==============================
    // 🔐 SESSIONS (refresh tokens) + login history
    // ==============================
    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getUserSessions(Long userId) {
        getUserEntityById(userId); // validate existence
        Instant now = Instant.now();

        List<RefreshTokenEntity> tokens = refreshTokenRepository.findByUser_UserId(userId);
        List<Map<String, Object>> sessions = tokens.stream()
                .sorted(Comparator.comparing(RefreshTokenEntity::getCreated,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(t -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", t.getId() != null ? t.getId().toString() : null);
                    m.put("created", t.getCreated());
                    m.put("expiry", t.getExpiry());
                    m.put("lastUsed", t.getLastUsed());
                    m.put("refreshCount", t.getRefreshCount() != null ? t.getRefreshCount() : 0);
                    m.put("active", t.getExpiry() != null && t.getExpiry().isAfter(now));
                    return m;
                })
                .toList();

        long activeCount = tokens.stream()
                .filter(t -> t.getExpiry() != null && t.getExpiry().isAfter(now))
                .count();

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
        result.put("activeCount", activeCount);
        result.put("sessions", sessions);
        result.put("loginHistory", loginHistory);
        result.put("biometricDevices", biometricDevices);
        return result;
    }

    @Override
    public int revokeUserSessions(Long userId) {
        getUserEntityById(userId); // validate existence
        long removed = refreshTokenRepository.deleteByUser_UserId(userId);
        log.warn("Revoked {} session(s) for user id={} by admin [{}]",
                removed, userId, userContext.userId());
        return (int) removed;
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
            long revoked = refreshTokenRepository.deleteByUser_UserId(userId);
            log.warn("User [{}] (id={}) disabled by admin [{}] — revoked {} session(s)",
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

        String previousRole = user.getRole() != null ? user.getRole().getName().name() : "<none>";
        user.setRole(role);

        UserEntity saved = userRepository.save(user);
        log.info("Role changed for user [{}] (id={}): {} → {}",
                saved.getEmail(), userId, previousRole, role.getName().name());
        return userMapper.toDto(saved);
    }

    // ==============================
    // âœ… DELETE
    // ==============================
    @Override
    public void deleteUserById(Long userId) {
        log.debug("deleteUserById called for userId={}", userId);

        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        if (userId.equals(userContext.userId())) {
            log.warn("deleteUserById rejected: user [{}] attempted self-delete", userId);
            throw new DbWorldException("You cannot delete yourself");
        }

        if (user.getRole().getName() == Role.ADMIN) {

            long adminCount = userRepository.countByRoleName(Role.ADMIN);

            if (adminCount <= 1) {
                log.warn("deleteUserById rejected: cannot delete last ADMIN (userId={})", userId);
                throw new DbWorldException("Cannot delete the last admin user");
            }
        }

        userRepository.delete(user);

        log.warn("User [{}] deleted by [{}]", userId, userContext.userId());
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