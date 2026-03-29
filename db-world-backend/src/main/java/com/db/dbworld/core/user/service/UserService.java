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

    // ==============================
    // 🔐 SECURITY
    // ==============================
    void changePassword(ChangePasswordRequest request);

    String getRoleForUser();

    // ==============================
    // 🗑 DELETE
    // ==============================
    void deleteUserById(Long id);
}