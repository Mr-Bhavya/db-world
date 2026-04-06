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

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
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
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;
    private final AuthenticationService authenticationService;

    /* ── Register ──────────────────────────────────────────────────── */

    @PostMapping("/register")
    public ApiResponse<UserDto> register(@Valid @RequestBody CreateUserRequest request) {
        UserDto createdUser = userService.createUser(request);
        log.info("New user registered: {}", createdUser.getEmail());
        return ApiResponse.success("User registered successfully", createdUser);
    }

    /* ── Login ─────────────────────────────────────────────────────── */

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

        ResponseCookie refreshCookie = ResponseCookie.from(REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken())
                .httpOnly(true)
                .secure(false) // ⚠️ IMPORTANT for localhost (HTTP)
                .sameSite("Lax") // ✅ works for local dev
                .path("/") // ✅ VERY IMPORTANT
                .maxAge(tokens.refreshTokenTtl())
                .build();

//        Production (HTTPS)
//                .secure(true)
//                .sameSite("None")

        ResponsePayloads.LoginResponse response = new ResponsePayloads.LoginResponse(
                tokens.accessToken(),
                tokens.user()
        );

        return ResponseEntity.ok()
                .header("Set-Cookie", refreshCookie.toString())
                .body(ApiResponse.success("Login successful", response));
    }

    /* ── Refresh token ─────────────────────────────────────────────── */

    /**
     * Exchange a valid refresh-token cookie for a new access token.
     *
     * Returns 401 (not 400) when the cookie is absent so that the frontend
     * axios interceptor treats it identically to an expired access token and
     * triggers the force-logout flow instead of an unhandled 400 error.
     */
    @PostMapping("/refresh-token")
    public ResponseEntity<?> refreshAccessToken(
            @CookieValue(name = REFRESH_TOKEN_COOKIE_NAME, required = false) String refreshToken
    ) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error(HttpStatus.UNAUTHORIZED, "No refresh token cookie"));
        }

        var tokens = authenticationService.refreshToken(refreshToken);

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "accessToken", tokens.accessToken()
        )));
    }

    /* ── Verify ────────────────────────────────────────────────────── */

    /**
     * Lightweight endpoint that confirms the Bearer token is valid.
     * Spring Security validates the JWT before this method is invoked;
     * an expired token triggers a 401 → the client interceptor refreshes it.
     */
    @GetMapping("/verify")
    public ApiResponse<Map<String, Object>> verifyToken(Authentication authentication) {

        if (authentication == null || !authentication.isAuthenticated()) {
            throw new RuntimeException("Invalid authentication");
        }

        List<String> roles = authentication.getAuthorities()
                .stream()
                .map(GrantedAuthority::getAuthority)
                .toList();

        return ApiResponse.success(Map.of(
                "username", authentication.getName(),
                "roles",    roles
        ));
    }

    /* ── Logout ────────────────────────────────────────────────────── */

    /**
     * Revoke the refresh token and clear the cookie.
     *
     * The cookie is optional (required = false) — if it is already expired
     * or absent the endpoint still succeeds and clears the cookie header,
     * so the client always ends up fully logged out regardless of server state.
     */
    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @CookieValue(name = REFRESH_TOKEN_COOKIE_NAME, required = false) String refreshToken
    ) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            try {
                authenticationService.revokeRefreshToken(refreshToken);
            } catch (Exception e) {
                // Token may already be expired / deleted — not an error from the client's view.
                log.warn("Logout: refresh token revocation skipped — {}", e.getMessage());
            }
        }

        return ResponseEntity.ok()
                .header(SET_COOKIE, removeCookie(REFRESH_TOKEN_COOKIE_NAME).toString())
                .body(ApiResponse.success("Logged out successfully"));
    }
}
