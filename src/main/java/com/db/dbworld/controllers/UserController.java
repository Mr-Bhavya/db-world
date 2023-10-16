package com.db.dbworld.controllers;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.UserDto;
import com.db.dbworld.services.UserService;
import com.db.dbworld.utils.DbWorldConstants;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.config.annotation.authentication.configuration.EnableGlobalAuthentication;
import org.springframework.security.config.annotation.method.configuration.EnableGlobalMethodSecurity;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/user")
@EnableMethodSecurity(prePostEnabled = true)
public class UserController {

    @Autowired
    private UserService userService;

    @GetMapping("/")
    @PreAuthorize("hasAuthority('owner')")
    public ApiResponse getAllUsers() {
        List<UserDto> userDtoList = this.userService.getAllUsers();
        return new ApiResponse(HttpStatus.OK, true, userDtoList);
    }

    @PostMapping("/")
    public ApiResponse createUser(@Valid @RequestBody UserDto userDto) {
        UserDto createdUser = this.userService.createUser(userDto);
        return new ApiResponse(HttpStatus.CREATED, true, createdUser);
    }

    @GetMapping("/{userId}")
    @PreAuthorize("hasAuthority('viewer')")
    public ApiResponse getUserById(@PathVariable(value = "userId") String userId){
        UserDto userDto = this.userService.getUserById(userId);
        return new ApiResponse(HttpStatus.OK, true, new UserDto[] {userDto});
    }
    @GetMapping("/userbyemail")
    public ApiResponse getUserByEmail(@RequestParam(value = "email") String email){
        UserDto userDto = this.userService.getUserByEmail(email);
        return new ApiResponse(HttpStatus.OK, true, new UserDto[]{userDto});
    }

    @PutMapping("/{userId}")
    public ApiResponse updateUser(@Valid
                                   @RequestBody UserDto userDto,
                                   @PathVariable(value = "userId") String userId
    ) {
        UserDto updatedUser = this.userService.updateUser(userDto, userId);
        return new ApiResponse(HttpStatus.OK, true, updatedUser);
    }

    @DeleteMapping("/{userId}")
    public ApiResponse deleteUser(@PathVariable(value = "userId") String userId) {
        this.userService.deleteUserById(userId);
        String message = "User with userId " + userId + " is deleted successfully.";
        return new ApiResponse(HttpStatus.OK, true, message);
    }

}
