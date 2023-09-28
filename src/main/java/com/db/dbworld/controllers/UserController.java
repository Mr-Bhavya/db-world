package com.db.dbworld.controllers;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.UserDto;
import com.db.dbworld.services.UserService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/user")
public class UserController {

    @Autowired
    private UserService userService;

    @GetMapping("/")
    private ApiResponse getAllUsers() {
        List<UserDto> userDtoList = this.userService.getAllUsers();
        return new ApiResponse(HttpStatus.OK, true, userDtoList);
    }

    @PostMapping("/")
    private ApiResponse createUser(@Valid @RequestBody UserDto userDto) {
        UserDto createdUser = this.userService.createUser(userDto);
        return new ApiResponse(HttpStatus.CREATED, true, createdUser);
    }

    @GetMapping("/{userId}")
    private ApiResponse getUserById(@PathVariable(value = "userId") String userId){
        UserDto userDto = this.userService.getUserById(userId);
        return new ApiResponse(HttpStatus.OK, true, new UserDto[] {userDto});
    }

    @PutMapping("/{userId}")
    private ApiResponse updateUser(@Valid
                                   @RequestBody UserDto userDto,
                                   @PathVariable(value = "userId") String userId
    ) {
        UserDto updatedUser = this.userService.updateUser(userDto, userId);
        return new ApiResponse(HttpStatus.OK, true, updatedUser);
    }

    @DeleteMapping("/{userId}")
    private ApiResponse deleteUser(@PathVariable(value = "userId") String userId) {
        this.userService.deleteUserById(userId);
        String message = "User with userId " + userId + " is deleted successfully.";
        return new ApiResponse(HttpStatus.OK, true, message);
    }

}
