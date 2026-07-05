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

    String getRoleForUser();

    // ==============================
    // 🗑 DELETE
    // ==============================
    void deleteUserById(Long id);
}