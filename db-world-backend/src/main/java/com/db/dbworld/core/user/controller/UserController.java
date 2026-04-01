package com.db.dbworld.core.user.controller;

import com.db.dbworld.core.role.annotations.AdminAccess;
import com.db.dbworld.core.role.annotations.AnyRole;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.core.user.dto.*;
import com.db.dbworld.audit.activity.dto.LoginDataDto;
import com.db.dbworld.audit.activity.service.LoginDataService;
import com.db.dbworld.core.user.service.UserService;
import com.db.dbworld.utils.DbWorldConstants;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/user")
@EnableMethodSecurity
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final LoginDataService loginDataService;

    // ==============================
    // ✅ CREATE USER
    // ==============================
    @AdminAccess
    @PostMapping
    public ApiResponse<UserDto> createUser(@Valid @RequestBody CreateUserRequest request) {
        return ApiResponse.success(userService.createUser(request));
    }

    @AdminAccess
    @PostMapping("/bulk")
    public ApiResponse<List<UserDto>> createUsers(
            @Valid @RequestBody List<CreateUserRequest> requests
    ) {
        return ApiResponse.success(userService.createUsers(requests));
    }

    // ==============================
    // ✅ GET USER BY ID
    // ==============================
    @AdminAccess
    @GetMapping("/{userId}")
    public ApiResponse<UserDto> getUserById(@PathVariable Long userId) {
        return ApiResponse.success(userService.getUserDtoById(userId));
    }

    // ==============================
    // ✅ GET ALL USERS (ADMIN ONLY)
    // ==============================
    @AdminAccess
    @GetMapping("/all")
    public ApiResponse<List<UserDto>> getAllUsers(Pageable pageable) {
        return ApiResponse.success(userService.getAllUsers(pageable));
    }

    // ==============================
    // ✅ Search (Auto Complete)
    // ==============================
    @AnyRole
    @GetMapping("/search")
    public ApiResponse<List<UserSearchResponse>> searchUsers(
            @RequestParam("q") String query,
            @RequestParam(defaultValue = "5") int limit
    ) {
        return ApiResponse.success(userService.searchUsers(query, limit));
    }

    // ==============================
    // ✅ GET PROFILE
    // ==============================
    @AnyRole
    @GetMapping("/profile")
    public ApiResponse<ResponsePayloads.UserProfileResponse> getUserProfile() {

        UserDto userDto = userService.getUserProfile();

        ResponsePayloads.UserProfileResponse profile =
                new ResponsePayloads.UserProfileResponse();

        // 🔒 Explicit safe mapping
        profile.setUserId(userDto.getUserId());
        profile.setFirstName(userDto.getFirstName());
        profile.setLastName(userDto.getLastName());
        profile.setEmail(userDto.getEmail());
        profile.setMobileNo(userDto.getMobileNo());
        profile.setUserRole(userDto.getUserRole());

        profile.setNoOfLogin(
                loginDataService.totalNumberOfLogin(userDto.getUserId())
        );

        return ApiResponse.success(profile);
    }

    // ==============================
    // ✅ UPDATE USER
    // ==============================
    @AnyRole
    @PutMapping("/{userId}")
    public ApiResponse<UserDto> updateUser(
            @Valid @RequestBody UpdateUserRequest request,
            @PathVariable Long userId
    ) {
        return ApiResponse.success(userService.updateUser(request, userId));
    }

    @AnyRole
    @PatchMapping("/{userId}/role")
    public ApiResponse<UserDto> updateUserRole(
            @PathVariable Long userId,
            @RequestParam Long roleId
    ) {
        return ApiResponse.success(userService.updateUserRole(userId, roleId));
    }

    // ==============================
    // ✅ Delete USER
    // ==============================
    @AdminAccess
    @DeleteMapping("/{userId}")
    public ApiResponse<Void> deleteUser(@PathVariable Long userId) {

        userService.deleteUserById(userId);

        return ApiResponse.success("User deleted successfully");
    }

    // ==============================
    // 🔐 CHANGE PASSWORD
    // ==============================
    @AnyRole
    @PatchMapping("/change-password")
    public ApiResponse<Void> changePassword(
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        userService.changePassword(request);
        return ApiResponse.success("Password updated successfully");
    }

    // ==============================
    // ✅ LOGIN HISTORY
    // ==============================
    @AnyRole
    @GetMapping("/login-history")
    public ApiResponse<List<LoginDataDto>> getLoginHistory() {
        UserDto userDto = userService.getUserProfile();
        return ApiResponse.success(loginDataService.getLoginHistory(userDto.getUserId()));
    }

    // ==============================
    // ✅ GET ROLE
    // ==============================
    @AnyRole
    @GetMapping("/role")
    public ApiResponse<Map<String, Object>> getUserRole() {

        Map<String, Object> response = new HashMap<>();
        response.put("role", userService.getRoleForUser());

        return ApiResponse.success(response);
    }
}