package com.db.dbworld.controllers;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.user.UserDto;
import com.db.dbworld.services.UserService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import jakarta.validation.Valid;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/user")
@EnableMethodSecurity(prePostEnabled = true)
public class UserController {

    @Autowired
    private UserService userService;
    @Autowired
    private ModelMapper modelMapper;

    @Autowired
    private DbWorldUtils dbWorldUtils;

    @GetMapping("/{userId}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<List<UserDto>> getUserById(@PathVariable(value = "userId") Long userId) {
        UserDto userDto = this.userService.getUserDtoById(userId);
        return new ApiResponse<>(HttpStatus.OK, true, Arrays.stream(new UserDto[] {userDto}).toList());
    }

    @PutMapping("/{userId}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<UserDto> updateUser(@Valid
                                  @RequestBody UserDto userDto,
                                  @PathVariable(value = "userId") Long userId
    ) {
        UserDto updatedUser = this.userService.updateUser(userDto, userId);
        return new ApiResponse<>(HttpStatus.OK, true, updatedUser);
    }

    @GetMapping("/{userId}/role")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<Map<String, Object>> getUserRole(@PathVariable(value = "userId") Long userId) {
        UserDto.UserRole userRole = this.userService.getRoleByUserId(userId, "username");
        Map<String, Object> response = new HashMap<>();
        response.put("userId", userId);
        response.put("role", userRole);
        return new ApiResponse<>(HttpStatus.OK, true, response);
    }

}
