package com.db.dbworld.core.user.service;

import com.db.dbworld.core.user.dto.*;
import com.db.dbworld.core.user.entity.UserEntity;
import org.springframework.data.domain.Pageable;

import java.util.Date;
import java.util.List;

public interface UserService {

    // ==============================
    // ✅ CREATE
    // ==============================
    UserDto createUser(CreateUserRequest request);

    List<UserDto> createUsers(List<CreateUserRequest> requests);

    // ==============================
    // ✅ READ
    // ==============================
    UserDto getUserDtoById(Long userId);

    UserEntity getUserEntityById(Long userId); // internal use

    List<UserDto> getAllUsers(Pageable pageable);

    java.util.Map<String, Object> getPagedUsers(String search, String role, int page, int size, String sortBy, String sortDir);

    List<UserSearchResponse> searchUsers(String query, int limit);

    UserDto getUserProfile();

    UserDto getUserDtoByEmail(String email);

    UserEntity getUserEntityByEmail(String email); // internal use

    // ==============================
    // ✅ UPDATE
    // ==============================
    UserDto updateUser(UpdateUserRequest request, Long userId);

    void updateDob(Date dob);

    UserDto updateUserRole(Long userId, Long roleId);

    /** Enable/disable a user. Disabling revokes their sessions and blocks login. */
    UserDto setUserEnabled(Long userId, boolean enabled);

    /** Lock/unlock a user. Locking revokes their sessions the same way disabling does. */
    UserDto setUserLocked(Long userId, boolean locked);

    /** Detaches a Google identity. Refused when it is the account's only sign-in method. */
    UserDto unlinkGoogle(Long userId);

    /** Cancels a pending deletion — called when the user signs back in during the grace window. */
    void restoreDeletedAccount(Long userId);

    // ==============================
    // 🔐 SECURITY
    // ==============================
    void changePassword(ChangePasswordRequest request);

    /** Admin resets another user's password (no old-password check, no full-profile payload). */
    void adminSetPassword(Long userId, String newPassword);

    /** Active refresh-token sessions + login history for a user (admin view). */
    java.util.Map<String, Object> getUserSessions(Long userId);

    /** Revoke every refresh-token session for a user (force logout). Returns count removed. */
    int revokeUserSessions(Long userId);

    /** Revoke one session by its rotation-family id. False when there was nothing live to revoke. */
    boolean revokeUserSession(Long userId, java.util.UUID familyId);

    /** Drop a user's biometric enrollments — another way into the account besides a password. */
    long revokeBiometricDevices(Long userId);

    /** Drop a user's push registrations, so notifications stop reaching an old device. */
    long revokePushTokens(Long userId);

    String getRoleForUser();

    // ==============================
    // 🗑 DELETE
    // ==============================

    /** Admin soft-delete: disables the account and schedules the purge after the grace window. */
    void deleteUserById(Long id);

    /** Admin hard-delete: runs the soft-delete checks, then erases immediately. */
    void purgeUserById(Long userId);

    /**
     * Self-service deletion. Requires re-authentication plus the account email typed back,
     * because this erases the document wallet and the password vault.
     *
     * @return when the data will actually be erased
     */
    java.time.Instant deleteOwnAccount(String password, String confirmEmail);
}