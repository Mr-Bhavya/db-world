package com.db.dbworld.security.auth.controller;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.LoginRequest;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.core.user.dto.CreateUserRequest;
import com.db.dbworld.core.user.dto.UserDto;
import com.db.dbworld.security.auth.AuthenticationService;
import com.db.dbworld.security.auth.BiometricDeviceService;
import com.db.dbworld.security.dto.AuthToken;
import com.db.dbworld.security.dto.BiometricDeviceDto;
import com.db.dbworld.security.dto.BiometricEnrollRequest;
import com.db.dbworld.security.dto.BiometricExchangeRequest;
import com.db.dbworld.security.dto.GoogleSignInRequest;
import com.db.dbworld.security.dto.SessionContext;
import com.db.dbworld.security.enums.ClientPlatform;
import com.db.dbworld.security.google.GoogleAuthService;
import com.db.dbworld.security.google.GoogleIdTokenVerifier;
import com.db.dbworld.config.JwtProperties;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.user.service.UserService;
import com.db.dbworld.utils.DbWorldUtils;

import jakarta.servlet.http.HttpServletRequest;
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
import static com.db.dbworld.utils.CookieUtil.refreshCookie;
import static com.db.dbworld.utils.CookieUtil.clearRefreshCookie;
import static org.springframework.http.HttpHeaders.SET_COOKIE;

@Log4j2
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    /**
     * Header native clients use to present the refresh token they hold in secure storage.
     * Web keeps using the httpOnly cookie and never sets this.
     */
    private static final String REFRESH_TOKEN_HEADER = "X-Refresh-Token";

    private final UserService userService;
    private final AuthenticationService authenticationService;
    private final BiometricDeviceService biometricDeviceService;
    private final GoogleAuthService googleAuthService;
    private final GoogleIdTokenVerifier googleIdTokenVerifier;
    private final JwtProperties jwtProperties;
    private final DbWorldUtils dbWorldUtils;

    /* ── Register ──────────────────────────────────────────────────── */

    @PostMapping("/register")
    public ApiResponse<UserDto> register(@Valid @RequestBody CreateUserRequest request) {
        log.debug("register called for email={}", request.getEmail());
        UserDto createdUser = userService.createUser(request);
        log.info("New user registered: {}", createdUser.getEmail());
        return ApiResponse.success("User registered successfully", createdUser);
    }

    /* ── Login ─────────────────────────────────────────────────────── */

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<ResponsePayloads.LoginResponse>> login(
            @Valid @RequestBody LoginRequest loginRequest,
            HttpServletRequest request
    ) {
        SessionContext context = sessionContext(request);
        AuthToken tokens = authenticationService.authenticate(
                context,
                loginRequest.getEmail().toLowerCase(),
                loginRequest.getPassword()
        );

        return sessionResponse(tokens, context, "Login successful");
    }

    /* ── Google Sign-In ────────────────────────────────────────────── */

    /**
     * Exchanges a Google ID token for a DB World session.
     *
     * <p>Google only establishes WHO the caller is. Everything downstream — the access token,
     * the rotating refresh token, the session row — is the same machinery a password login
     * uses, so nothing else in the system has to know this sign-in came from Google.
     */
    @PostMapping("/google")
    public ResponseEntity<ApiResponse<ResponsePayloads.LoginResponse>> googleSignIn(
            @Valid @RequestBody GoogleSignInRequest signInRequest,
            HttpServletRequest request
    ) {
        SessionContext context = sessionContext(request);
        AuthToken tokens = googleAuthService.signIn(signInRequest.idToken(), context);
        return sessionResponse(tokens, context, "Signed in with Google");
    }

    /** Lets the client hide the Google button when the server has no client ids configured. */
    @GetMapping("/providers")
    public ApiResponse<Map<String, Object>> providers() {
        return ApiResponse.success(Map.of("google", googleIdTokenVerifier.isEnabled()));
    }

    /* ── Refresh token ─────────────────────────────────────────────── */

    /**
     * Rotates the session: returns a new access token and a new refresh token.
     *
     * <p>The old refresh token is spent by this call, so a client that drops the response
     * loses the session — that is the deliberate cost of reuse detection. The frontend
     * coalesces concurrent refreshes into one in-flight request for exactly this reason.
     */
    @PostMapping("/refresh-token")
    public ResponseEntity<?> refreshAccessToken(
            @CookieValue(name = REFRESH_TOKEN_COOKIE_NAME, required = false) String cookieToken,
            HttpServletRequest request
    ) {
        SessionContext context = sessionContext(request);
        String refreshToken = presentedRefreshToken(cookieToken, request);

        if (refreshToken == null) {
            log.warn("Refresh-token request carried neither cookie nor {} header", REFRESH_TOKEN_HEADER);
            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error(HttpStatus.UNAUTHORIZED, "No refresh token"));
        }

        AuthToken tokens = authenticationService.refreshToken(refreshToken, context);

        Map<String, Object> body = context.platform().isNative()
                ? Map.of("accessToken", tokens.accessToken(), "refreshToken", tokens.refreshToken())
                : Map.of("accessToken", tokens.accessToken());

        return ResponseEntity.ok()
                .header(SET_COOKIE, buildRefreshCookie(tokens).toString())
                .body(ApiResponse.success(body));
    }

    /* ── Verify ────────────────────────────────────────────────────── */

    @GetMapping("/verify")
    public ApiResponse<Map<String, Object>> verifyToken(Authentication authentication) {

        if (authentication == null || !authentication.isAuthenticated()) {
            log.warn("Verify endpoint hit without authenticated principal");
            throw new DbWorldException(HttpStatus.UNAUTHORIZED, "Invalid authentication");
        }

        List<String> roles = authentication.getAuthorities()
                .stream()
                .map(GrantedAuthority::getAuthority)
                .toList();

        log.debug("verify ok for user [{}], roles={}", authentication.getName(), roles);

        return ApiResponse.success(Map.of(
                "username", authentication.getName(),
                "roles",    roles
        ));
    }

    /* ── Biometric device unlock ───────────────────────────────────── */

    /** Enroll the caller's device — returns a raw device token ONCE, stored on-device behind biometrics. */
    @PostMapping("/biometric/enroll")
    public ApiResponse<Map<String, String>> enrollBiometric(
            Authentication authentication,
            @Valid @RequestBody BiometricEnrollRequest request) {
        String email = requireAuth(authentication);
        String token = biometricDeviceService.enroll(email, request.deviceId(), request.deviceLabel());
        return ApiResponse.success("Biometric device enrolled", Map.of("deviceToken", token));
    }

    /** Public: exchange a device token for a fresh session (same shape as /login). No bearer token. */
    @PostMapping("/biometric/exchange")
    public ResponseEntity<ApiResponse<ResponsePayloads.LoginResponse>> exchangeBiometric(
            @Valid @RequestBody BiometricExchangeRequest exchangeRequest,
            HttpServletRequest request) {
        SessionContext context = sessionContext(request);
        AuthToken tokens = biometricDeviceService.exchange(exchangeRequest.deviceToken(), context);
        return sessionResponse(tokens, context, "Login successful");
    }

    /** List the caller's enrolled devices (device-management UI). */
    @GetMapping("/biometric/devices")
    public ApiResponse<List<BiometricDeviceDto>> listBiometricDevices(Authentication authentication) {
        return ApiResponse.success(biometricDeviceService.list(requireAuth(authentication)));
    }

    /** Revoke one enrolled device for the caller. */
    @DeleteMapping("/biometric/devices/{deviceId}")
    public ApiResponse<Void> revokeBiometricDevice(Authentication authentication, @PathVariable String deviceId) {
        biometricDeviceService.revoke(requireAuth(authentication), deviceId);
        return ApiResponse.success("Biometric device revoked");
    }

    /**
     * These endpoints sit under permitAll /api/auth/** (so /exchange is reachable without a token),
     * so we enforce authentication explicitly for the ones that need it, mirroring /verify.
     */
    private String requireAuth(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new DbWorldException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return authentication.getName();
    }

    /* ── Logout ────────────────────────────────────────────────────── */

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @CookieValue(name = REFRESH_TOKEN_COOKIE_NAME, required = false) String cookieToken,
            HttpServletRequest request
    ) {
        String refreshToken = presentedRefreshToken(cookieToken, request);
        log.debug("logout called (hasRefreshToken={})", refreshToken != null);

        if (refreshToken != null) {
            try {
                authenticationService.revokeRefreshToken(refreshToken);
            } catch (Exception e) {
                log.warn("Logout: refresh token revocation skipped — {}", e.getMessage());
            }
        }
        log.info("User logged out");

        return ResponseEntity.ok()
                .header(SET_COOKIE, clearRefreshCookie(REFRESH_TOKEN_COOKIE_NAME,
                        jwtProperties.cookieSecure(), jwtProperties.cookieSameSite()).toString())
                .body(ApiResponse.success("Logged out successfully"));
    }

    /* ── Internal ──────────────────────────────────────────────────── */

    /** Captures who is asking, so the service layer never touches the servlet request. */
    private SessionContext sessionContext(HttpServletRequest request) {
        return new SessionContext(
                ClientPlatform.from(request.getHeader(ClientPlatform.HEADER)),
                defaultIfBlank(request.getHeader("User-Agent"), "unknown"),
                dbWorldUtils.getClientIpAddress(request));
    }

    /**
     * Reads the refresh token from wherever this client keeps it.
     *
     * <p>The cookie wins when both are present: on web it is the httpOnly one the browser
     * manages, and preferring a caller-supplied header there would let script-injected content
     * choose the token.
     */
    private String presentedRefreshToken(String cookieToken, HttpServletRequest request) {
        if (cookieToken != null && !cookieToken.isBlank()) {
            return cookieToken;
        }
        String header = request.getHeader(REFRESH_TOKEN_HEADER);
        return (header != null && !header.isBlank()) ? header : null;
    }

    /**
     * Builds the session response.
     *
     * <p>The cookie is always set — it costs nothing and keeps web working — but the token is
     * only echoed in the body for native clients, which have nowhere reliable to keep a
     * cross-site cookie and store it in the Keychain / AndroidKeyStore instead.
     */
    private ResponseEntity<ApiResponse<ResponsePayloads.LoginResponse>> sessionResponse(
            AuthToken tokens, SessionContext context, String message) {

        ResponsePayloads.LoginResponse response = new ResponsePayloads.LoginResponse(
                tokens.accessToken(),
                context.platform().isNative() ? tokens.refreshToken() : null,
                tokens.user());

        return ResponseEntity.ok()
                .header(SET_COOKIE, buildRefreshCookie(tokens).toString())
                .body(ApiResponse.success(message, response));
    }

    private ResponseCookie buildRefreshCookie(AuthToken tokens) {
        return refreshCookie(
                REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken(), tokens.refreshTokenTtl(),
                jwtProperties.cookieSecure(), jwtProperties.cookieSameSite());
    }

    private static String defaultIfBlank(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value;
    }
}
