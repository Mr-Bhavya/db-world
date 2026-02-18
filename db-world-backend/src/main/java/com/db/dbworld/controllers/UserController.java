package com.db.dbworld.controllers;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.payloads.user.UserDto;
import com.db.dbworld.services.auth.LoginDataService;
import com.db.dbworld.services.user.UserService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import jakarta.validation.Valid;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@CrossOrigin
@RestController
@RequestMapping("/api/user")
@EnableMethodSecurity
public class UserController {

    @Autowired private UserService userService;
    @Autowired private ModelMapper modelMapper;
    @Autowired private DbWorldUtils dbWorldUtils;
    @Autowired private LoginDataService loginDataService;

    @GetMapping("/{userId}")
    @PreAuthorize(DbWorldConstants.OWNER_AUTHORIZE)
    public ApiResponse<List<UserDto>> getUserById(@PathVariable Long userId) {
        return ApiResponse.success(List.of(userService.getUserDtoById(userId)));
    }

    @GetMapping("/")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<List<ResponsePayloads.UserProfileResponse>> getUserProfile() {
        UserDto userDto = userService.getUserProfile();
        ResponsePayloads.UserProfileResponse profile = modelMapper.map(userDto, ResponsePayloads.UserProfileResponse.class);
        profile.setNoOfLogin(loginDataService.totalNumberOfLogin(userDto.getUserId()));
        return ApiResponse.success(List.of(profile));
    }

    @PutMapping("/{userId}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<UserDto> updateUser(@Valid @RequestBody UserDto userDto, @PathVariable Long userId) {
        return ApiResponse.success(userService.updateUser(userDto, userId));
    }

    @GetMapping("/role")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<Map<String, Object>> getUserRole() {
        Map<String, Object> r = new HashMap<>();
        r.put("userId", userService.getUserIdFromToken());
        r.put("role", userService.getRoleForUser());
        return ApiResponse.success(r);
    }

    @PutMapping("/dob={dob}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<Void> updateDobForUser(@PathVariable @DateTimeFormat(pattern = "yyyy-MM-dd") Date dob) {
        userService.updateDob(dob);
        return ApiResponse.success("Dob is updated");
    }
}
