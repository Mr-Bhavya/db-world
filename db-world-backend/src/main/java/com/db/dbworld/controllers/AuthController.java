package com.db.dbworld.controllers;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.LoginRequest;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.payloads.user.UserDto;
import com.db.dbworld.services.auth.AuthenticationService;
import com.db.dbworld.services.auth.LoginDataService;
import com.db.dbworld.services.user.UserService;
import jakarta.validation.Valid;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.util.*;

import static com.db.dbworld.helpers.DbWorldRecords.AuthTokens.REFRESH_TOKEN_COOKIE_NAME;
import static com.db.dbworld.utils.CookieUtil.addCookie;
import static com.db.dbworld.utils.CookieUtil.removeCookie;
import static org.springframework.http.HttpHeaders.SET_COOKIE;

@Log4j2
@RestController
@CrossOrigin
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;
    private final AuthenticationService authenticationService;

    public AuthController(UserService userService, AuthenticationService authenticationService) {
        this.userService = userService;
        this.authenticationService = authenticationService;
    }

    @PostMapping("/register")
    public ApiResponse<Void> registerNewUser(@Valid @RequestBody UserDto userDto) {
        UserDto createdUser = userService.createUser(List.of(userDto)).getFirst();
        log.info("New user registered: {}", createdUser.getEmail());
        return ApiResponse.success("User registered successfully");
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<ResponsePayloads.LoginResponse>> login(@Valid @RequestBody LoginRequest loginRequest, @RequestHeader HttpHeaders headers) {

        String userAgent = Objects.requireNonNull(headers.get("user-agent")).get(0);
        var tokens = authenticationService.authenticate(userAgent, loginRequest.getEmail().toLowerCase(), loginRequest.getPassword());

        ResponsePayloads.LoginResponse response = new ResponsePayloads.LoginResponse(tokens.accessToken(), tokens.userEntity());

        return ResponseEntity.ok()
                .header(SET_COOKIE, addCookie(REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken(), tokens.refreshTokenTtl()).toString())
                .body(ApiResponse.success("Login successful", response));
    }

    @PostMapping("/refresh-token")
    public ApiResponse<Map<String, String>> refreshAccessToken(@CookieValue(REFRESH_TOKEN_COOKIE_NAME) String refreshToken) {
        var tokens = authenticationService.refreshToken(refreshToken);
        return ApiResponse.success(Map.of("accessToken", tokens.accessToken()));
    }

    @GetMapping("/verify")
    public ApiResponse<Map<String, Object>> verifyToken(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new RuntimeException("Invalid authentication");
        }

        Map<String, Object> response = new HashMap<>();
        response.put("username", authentication.getName());
        response.put("roles", authentication.getAuthorities().stream().map(GrantedAuthority::getAuthority).toList());

        return ApiResponse.success(response);
    }

    @PostMapping("/log-out")
    public ResponseEntity<ApiResponse<Void>> logout(@CookieValue(REFRESH_TOKEN_COOKIE_NAME) String refreshToken) {
        authenticationService.revokeRefreshToken(refreshToken);
        return ResponseEntity.ok()
                .header(SET_COOKIE, removeCookie(REFRESH_TOKEN_COOKIE_NAME).toString())
                .body(ApiResponse.success("Logged out successfully"));
    }
}
