package com.db.dbworld.controllers;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.LoginRequest;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.core.user.dto.CreateUserRequest;
import com.db.dbworld.core.user.dto.UserDto;
import com.db.dbworld.security.auth.AuthenticationService;
import com.db.dbworld.core.user.service.UserService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

import static com.db.dbworld.helpers.DbWorldRecords.AuthTokens.REFRESH_TOKEN_COOKIE_NAME;
import static com.db.dbworld.utils.CookieUtil.addCookie;
import static com.db.dbworld.utils.CookieUtil.removeCookie;
import static org.springframework.http.HttpHeaders.SET_COOKIE;

@Log4j2
@RestController
@CrossOrigin
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;
    private final AuthenticationService authenticationService;

    // ==============================
    // ✅ REGISTER
    // ==============================
    @PostMapping("/register")
    public ApiResponse<UserDto> register(@Valid @RequestBody CreateUserRequest request) {

        UserDto createdUser = userService.createUser(request);

        log.info("New user registered: {}", createdUser.getEmail());

        return ApiResponse.success("User registered successfully", createdUser);
    }

    // ==============================
    // ✅ LOGIN
    // ==============================
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<ResponsePayloads.LoginResponse>> login(
            @Valid @RequestBody LoginRequest loginRequest,
            @RequestHeader(value = "User-Agent", defaultValue = "unknown") String userAgent
    ) {

        var tokens = authenticationService.authenticate(
                userAgent,
                loginRequest.getEmail().toLowerCase(),
                loginRequest.getPassword()
        );

        ResponsePayloads.LoginResponse response =
                new ResponsePayloads.LoginResponse(
                        tokens.accessToken(),
                        tokens.user() // ⚠️ see note below
                );

        return ResponseEntity.ok()
                .header(SET_COOKIE,
                        addCookie(
                                REFRESH_TOKEN_COOKIE_NAME,
                                tokens.refreshToken(),
                                tokens.refreshTokenTtl()
                        ).toString()
                )
                .body(ApiResponse.success("Login successful", response));
    }

    // ==============================
    // 🔄 REFRESH TOKEN
    // ==============================
    @PostMapping("/refresh-token")
    public ApiResponse<Map<String, String>> refreshAccessToken(
            @CookieValue(REFRESH_TOKEN_COOKIE_NAME) String refreshToken
    ) {

        var tokens = authenticationService.refreshToken(refreshToken);

        return ApiResponse.success(Map.of(
                "accessToken", tokens.accessToken()
        ));
    }

    // ==============================
    // ✅ VERIFY TOKEN
    // ==============================
    @GetMapping("/verify")
    public ApiResponse<Map<String, Object>> verifyToken(Authentication authentication) {

        if (authentication == null || !authentication.isAuthenticated()) {
            throw new RuntimeException("Invalid authentication");
        }

        return ApiResponse.success(Map.of(
                "username", authentication.getName(),
                "roles", authentication.getAuthorities()
                        .stream()
                        .map(GrantedAuthority::getAuthority)
                        .toList()
        ));
    }

    // ==============================
    // 🚪 LOGOUT
    // ==============================
    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @CookieValue(REFRESH_TOKEN_COOKIE_NAME) String refreshToken
    ) {

        authenticationService.revokeRefreshToken(refreshToken);

        return ResponseEntity.ok()
                .header(SET_COOKIE, removeCookie(REFRESH_TOKEN_COOKIE_NAME).toString())
                .body(ApiResponse.success("Logged out successfully"));
    }
}