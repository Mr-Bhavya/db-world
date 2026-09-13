package com.db.dbworld.security.auth.controller;

import com.db.dbworld.config.JwtProperties;
import com.db.dbworld.core.user.service.UserService;
import com.db.dbworld.security.auth.AuthenticationService;
import com.db.dbworld.security.auth.BiometricDeviceService;
import com.db.dbworld.security.auth.LoginRateLimiter;
import com.db.dbworld.security.dto.AuthToken;
import com.db.dbworld.security.enums.ClientPlatform;
import com.db.dbworld.security.google.GoogleAuthService;
import com.db.dbworld.security.google.GoogleIdTokenVerifier;
import com.db.dbworld.security.token.AccountRecoveryService;
import com.db.dbworld.utils.DbWorldUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The cross-site guard on {@code POST /api/auth/refresh-token}.
 *
 * <p>This is the only endpoint authenticated purely by an ambient credential. The refresh cookie is
 * {@code SameSite=None} (the Android WebView is genuinely cross-site), app-wide CSRF protection is
 * off, and the handler takes no {@code @RequestBody} — so a plain cross-site form POST was a SIMPLE
 * request: no preflight, CORS never consulted, cookie attached, token rotated.
 *
 * <p>Nothing was stolen — the attacker cannot read the response. What it did was SPEND the token:
 * the victim's browser keeps the old cookie, the server marks it used, and their next genuine
 * refresh trips reuse detection, which revokes the family and signs them out. Any site they
 * visited could log them out of DB World on demand.
 */
class AuthControllerRefreshCsrfTest {

    private AuthenticationService authenticationService;
    private DbWorldUtils dbWorldUtils;
    private AuthController controller;

    @BeforeEach
    void setUp() {
        authenticationService = mock(AuthenticationService.class);
        dbWorldUtils = mock(DbWorldUtils.class);

        JwtProperties jwtProperties = mock(JwtProperties.class);
        when(jwtProperties.cookieSecure()).thenReturn(true);
        when(jwtProperties.cookieSameSite()).thenReturn("None");
        when(dbWorldUtils.getClientIpAddress(any())).thenReturn("203.0.113.7");

        controller = new AuthController(
                mock(UserService.class),
                authenticationService,
                mock(LoginRateLimiter.class),
                mock(BiometricDeviceService.class),
                mock(GoogleAuthService.class),
                mock(GoogleIdTokenVerifier.class),
                mock(AccountRecoveryService.class),
                jwtProperties,
                dbWorldUtils);

        when(authenticationService.refreshToken(anyString(), any())).thenReturn(
                new AuthToken("new-access", UUID.randomUUID().toString(), UUID.randomUUID(),
                        Duration.ofDays(30), null));
    }

    /** A request carrying only the cookie — no custom headers, as a cross-site form POST would be. */
    private static HttpServletRequest request(String platformHeader, String refreshHeader) {
        HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getHeader(ClientPlatform.HEADER)).thenReturn(platformHeader);
        when(req.getHeader("X-Refresh-Token")).thenReturn(refreshHeader);
        when(req.getHeader("User-Agent")).thenReturn("Mozilla/5.0");
        return req;
    }

    @Test
    void rejectsACookieOnlyRefreshWithNoCustomHeader() {
        // The forged shape. A cross-site <form> can send the cookie but cannot set a header.
        ResponseEntity<?> response = controller.refreshAccessToken("cookie-token", request(null, null));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        // The critical assertion: the token must NOT have been rotated. Rotating and then refusing
        // to answer would still have spent it, which is the whole attack.
        verify(authenticationService, never()).refreshToken(anyString(), any());
    }

    @Test
    void allowsTheWebClient_whichAlwaysSendsTheClientPlatformHeader() {
        ResponseEntity<?> response = controller.refreshAccessToken("cookie-token", request("web", null));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(authenticationService).refreshToken(anyString(), any());
    }

    @Test
    void allowsTheNativeClient_whichPresentsTheTokenInItsOwnHeader() {
        ResponseEntity<?> response =
                controller.refreshAccessToken(null, request("android", "stored-refresh-token"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(authenticationService).refreshToken(anyString(), any());
    }

    @Test
    void stillReturnsUnauthorizedWhenNoTokenIsPresentedAtAll() {
        // Ordering matters: "you sent nothing" must stay a 401 rather than being reclassified as
        // a 403 by the new guard, or a signed-out visitor looks like an attacker in the logs.
        ResponseEntity<?> response = controller.refreshAccessToken(null, request(null, null));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
