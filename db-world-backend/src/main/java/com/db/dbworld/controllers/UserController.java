package com.db.dbworld.controllers;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.Credential;
import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.payloads.user.UserDto;
import com.db.dbworld.services.UserService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.web.bind.annotation.*;

import java.net.MalformedURLException;
import java.net.URL;
import java.util.Date;
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

    @GetMapping("/")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse getAllUsers() {
        List<UserDto> userDtoList = this.userService.getAllUsers();
        ApiResponse<UserDto> apiResponse = new ApiResponse(HttpStatus.OK, true, userDtoList);
        return apiResponse;
    }

    @PostMapping("/")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse createUser(@Valid @RequestBody UserDto userDto) {
        UserDto createdUser = this.userService.createUser(userDto);
        return new ApiResponse(HttpStatus.CREATED, true, createdUser);
    }

    @GetMapping("/{userId}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse getUserById(@PathVariable(value = "userId") String userId) {
        UserDto userDto = this.userService.getUserById(userId);
        return new ApiResponse(HttpStatus.OK, true, new UserDto[]{userDto});
    }

    @GetMapping("/userbyemail")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse getUserByEmail(@RequestParam(value = "email") String email) {
        UserDto userDto = this.userService.getUserByEmail(email);
        return new ApiResponse(HttpStatus.OK, true, new UserDto[]{userDto});
    }

    @PutMapping("/{userId}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse updateUser(@Valid
                                  @RequestBody UserDto userDto,
                                  @PathVariable(value = "userId") String userId
    ) {
        UserDto updatedUser = this.userService.updateUser(userDto, userId);
        return new ApiResponse(HttpStatus.OK, true, updatedUser);
    }

    @DeleteMapping("/{userId}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse deleteUser(@PathVariable(value = "userId") String userId) {
        this.userService.deleteUserById(userId);
        String message = "User with userId " + userId + " is deleted successfully.";
        return new ApiResponse(HttpStatus.OK, true, message);
    }

    @GetMapping("/{userId}/role")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse getUserRole(@PathVariable(value = "userId") String userId,
                                   HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        String token = bearerToken.substring(7);
        String username = this.dbWorldUtils.getUserFromToken(token);
        UserDto.UserRole userRole = this.userService.getRoleByUserId(userId, username);
        Map<String, Object> response = new HashMap<>();
        response.put("userId", userId);
        response.put("role", userRole);
        return new ApiResponse(HttpStatus.OK, true, response);
    }

    @PostMapping("/{userId}/role")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse addUpdateUserRoleByUserId(@PathVariable String userId, @RequestBody @Valid UserDto.UserRole role) {
        UserDto.UserRole updatedUserRole = this.userService.addUpdateUserRoleByUserId(userId, role);
        return new ApiResponse(HttpStatus.OK, true, updatedUserRole);
    }

    @GetMapping("/{userId}/userAppData/")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse getUserAppDataByUserId(@PathVariable String userId) {
        UserDto.UserAppData userAppDataDto = this.userService.getUserAppDataByUserId(userId);
        return new ApiResponse(HttpStatus.OK, true, userAppDataDto);
    }

    @DeleteMapping("/{userId}/userAppData/")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse deleteUserAppDataByUserId(@PathVariable String userId) {
        this.userService.deleteUserAppDataByUserId(userId);
        String message = "UserAppData is deleted under userId: " + userId;
        return new ApiResponse(HttpStatus.OK, true, message);
    }

    @DeleteMapping("/userAppData/{userAppDataId}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse deleteUserAppDataById(@PathVariable String userAppDataId) {
        this.userService.deleteUserAppDataById(userAppDataId);
        String message = "UserAppData is deleted for useAppDataId: " + userAppDataId;
        return new ApiResponse(HttpStatus.OK, true, message);
    }

    @PostMapping("/{userId}/credential")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse addCredential(
            @PathVariable String userId,
            @Valid @RequestBody RequestPayloads.AddCredential addCredential
    ) {
        try {
            String host = new URL(addCredential.getUrl().toLowerCase()).getHost(); //lower case is required otherwise it differ the IV and give problem to decode.
            Credential credential = this.modelMapper.map(addCredential, Credential.class);
            credential.setId(new Date().getTime());
            userService.addCredential(userId, host, credential);
            return new ApiResponse(HttpStatus.CREATED, true, "Credential is added.");
        } catch (MalformedURLException ex) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
    }

    @GetMapping("/{userId}/credential")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse getCredentials(@PathVariable String userId) {
        List<ResponsePayloads.PasswordManagerCredential> passwordManager = userService.getCredentials(userId);
        return new ApiResponse(HttpStatus.OK, true, passwordManager);
    }

    @GetMapping("/{userId}/credential/{credentialId}")
    public ApiResponse getCredentialById(@PathVariable String userId, @PathVariable long credentialId) {
        //TODO
        return null;
    }


    @PutMapping("/{userId}/credential/{credentialId}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse updateCredential(@PathVariable String userId,
                                        @Valid @NotNull @PathVariable long credentialId,
                                        @Valid @RequestBody RequestPayloads.AddCredential addCredential) {
        String host = addCredential.getUrl();
        Credential credential = this.modelMapper.map(addCredential, Credential.class);
        credential.setId(credentialId);
        userService.updateCredential(userId, host, credential);
        return new ApiResponse(HttpStatus.OK, true, "Credential is update.");
    }

    @DeleteMapping("/{userId}/credential/{credentialId}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse deleteCredential(
            @Valid @NotNull @PathVariable String userId,
            @Valid @NotNull @PathVariable long credentialId,
            @Valid @NotNull @RequestParam String pmId
    ) {
        userService.deleteCredential(userId, pmId, credentialId);
        return new ApiResponse(HttpStatus.OK, true, "Credential is deleted.");
    }

    @DeleteMapping("/{userId}/pm/{pmId}") // Delete Host by ID
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse deletePasswordManagerById(
            @Valid @NotNull @PathVariable String userId,
            @Valid @NotNull @PathVariable String pmId
    ) {
//        userService.deleteCredential(userId, pmId, credentialId);
        return new ApiResponse(HttpStatus.OK, true, "Feature is in development. It will live shortly.");
    }

}
