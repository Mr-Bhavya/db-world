package com.db.dbworld.security.auth;

import com.db.dbworld.security.dto.AuthToken;
import com.db.dbworld.security.dto.SessionContext;
import com.db.dbworld.security.repository.RefreshTokenRepository;
import com.db.dbworld.security.entity.RefreshTokenEntity;
import com.db.dbworld.security.entity.RefreshTokenEntity.RevokeReason;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.mapper.UserMapper;
import com.db.dbworld.audit.activity.dto.LoginDataDto;
import com.db.dbworld.audit.activity.service.LoginDataService;
import com.db.dbworld.core.user.service.UserService;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Log4j2
@Service
@RequiredArgsConstructor
public class AuthenticationService {

    private final Duration refreshTokenTtl = Duration.ofDays(30);

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final LoginDataService loginDataService;
    private final UserService userService;
    private final RefreshTokenRepository refreshTokenRepository;
    private final SessionRevocationService sessionRevocationService;
    private final UserMapper userMapper;

    // ==============================
    // ✅ LOGIN
    // ==============================
    public AuthToken authenticate(
            SessionContext context,
            String email,
            String password
    ) {
        log.debug("authenticate called for email={} (platform={})", email, context.platform());

        var authToken = UsernamePasswordAuthenticationToken.unauthenticated(email, password);

        try {
            authenticationManager.authenticate(authToken);
        } catch (BadCredentialsException ex) {
            log.warn("Login attempt rejected for email={} — bad credentials", email);
            throw ex;
        } catch (Exception ex) {
            log.error("Authentication failed for email={}: {}", email, ex.getMessage(), ex);
            throw ex;
        }

        UserEntity user = userService.getUserEntityByEmail(email);

        // Signing in during the grace window is how a deletion is undone. The provider let
        // this through knowing the account was only disabled by the deletion itself.
        if (user.isPendingDeletion()) {
            userService.restoreDeletedAccount(user.getUserId());
            user = userService.getUserEntityByEmail(email);
        }

        AuthToken tokens = generateTokens(user, context);

        updateLoginData(user, context.userAgent());

        return tokens;
    }

    // ==============================
    // 🔄 REFRESH TOKEN (rotating)
    // ==============================

    /**
     * Exchanges a refresh token for a new access token AND a new refresh token.
     *
     * <p>The presented row is spent and a successor is inserted into the same family, so a
     * token is only ever valid once. That turns a stolen token into a detectable event: when
     * a token that has already been spent comes back, either the thief or the legitimate user
     * is replaying it, and we cannot tell which — so the whole family is revoked and the
     * access tokens are invalidated. Both parties get signed out, which is the correct
     * outcome, because the alternative leaves the attacker with a live session.
     */
    @Transactional
    public AuthToken refreshToken(String refreshToken, SessionContext context) {
        log.debug("refreshToken called (token ref={})", tokenRef(refreshToken));

        UUID tokenId = parseToken(refreshToken);
        Instant now = Instant.now();

        RefreshTokenEntity presented = refreshTokenRepository
                .findByIdWithUser(tokenId)
                .orElseThrow(() -> {
                    log.warn("Refresh token rejected: unknown (token ref={})", tokenRef(refreshToken));
                    return new BadCredentialsException("Invalid or expired refresh token");
                });

        // Replay of a spent token — treat as a compromise, not a retry.
        if (presented.getUsedAt() != null) {
            handleReuse(presented);
            throw new BadCredentialsException("Invalid or expired refresh token");
        }

        if (presented.getRevokedAt() != null) {
            log.warn("Refresh token rejected: revoked ({}) for user [{}]",
                    presented.getRevokedReason(), presented.getUser().getEmail());
            throw new BadCredentialsException("Invalid or expired refresh token");
        }

        if (presented.getExpiry() == null || !presented.getExpiry().isAfter(now)) {
            log.warn("Refresh token rejected: expired for user [{}]", presented.getUser().getEmail());
            throw new BadCredentialsException("Invalid or expired refresh token");
        }

        UserEntity user = presented.getUser();
        if (!user.isEnabled() || !user.isAccountNonLocked()) {
            log.warn("Refresh rejected: account disabled/locked for user [{}]", user.getEmail());
            throw new DisabledException("Account is disabled");
        }
        if (user.isPendingDeletion()) {
            // The account is inside its deletion grace window. Refreshing would quietly keep a
            // deleted session alive, so it has to go through a fresh sign-in — which is also
            // what restores the account.
            log.warn("Refresh rejected: account pending deletion for user [{}]", user.getEmail());
            throw new DisabledException("Account is scheduled for deletion");
        }

        // Spend the presented token, then hand out its successor in the same family.
        presented.setUsedAt(now);
        presented.setLastUsed(now);
        presented.setRefreshCount((presented.getRefreshCount() == null ? 0 : presented.getRefreshCount()) + 1);
        refreshTokenRepository.save(presented);

        RefreshTokenEntity successor = newToken(user, presented.getFamilyId(), context, presented);
        // The family keeps the original expiry: rotation must not let a session extend itself
        // indefinitely past the 30-day limit it was granted at sign-in.
        successor.setExpiry(presented.getExpiry());
        successor.setRefreshCount(presented.getRefreshCount());
        refreshTokenRepository.save(successor);

        String newAccessToken = jwtService.generateToken(user);
        log.info("Session refreshed for user [{}] (family={}, refreshes={})",
                user.getEmail(), presented.getFamilyId(), successor.getRefreshCount());

        return new AuthToken(
                newAccessToken,
                successor.getId().toString(),
                successor.getFamilyId(),
                Duration.between(now, successor.getExpiry()),
                userMapper.toDto(user)
        );
    }

    /**
     * A spent refresh token came back. Kill the entire family and every access token the user
     * holds — we cannot distinguish the victim from the attacker, so neither keeps access.
     */
    private void handleReuse(RefreshTokenEntity presented) {
        UserEntity user = presented.getUser();
        log.error("SECURITY: refresh-token reuse detected for user [{}] (family={}). "
                        + "Revoking the whole family and invalidating access tokens.",
                user.getEmail(), presented.getFamilyId());

        sessionRevocationService.revokeAll(
                user.getUserId(), RevokeReason.REUSE_DETECTED, null);
    }

    // ==============================
    // 🚪 LOGOUT
    // ==============================

    /** Ends the session the presented token belongs to — the whole family, not just this token. */
    @Transactional
    public void revokeRefreshToken(String refreshToken) {
        log.debug("revokeRefreshToken called (token ref={})", tokenRef(refreshToken));
        UUID tokenId = parseToken(refreshToken);

        refreshTokenRepository.findByIdWithUser(tokenId).ifPresentOrElse(
                token -> {
                    refreshTokenRepository.revokeFamily(
                            token.getFamilyId(), RevokeReason.LOGOUT, Instant.now());
                    log.info("Session ended for user [{}] (family={})",
                            token.getUser().getEmail(), token.getFamilyId());
                },
                () -> log.debug("Logout for unknown refresh token (ref={}) — nothing to revoke",
                        tokenRef(refreshToken)));
    }

    // ==============================
    // 🔑 ISSUE SESSION (alternate auth paths — biometric, Google)
    // ==============================
    /** Mints a fresh session (access token + persisted refresh token) for an already-verified user. */
    public AuthToken issueSession(UserEntity user, SessionContext context) {
        return generateTokens(user, context);
    }

    /**
     * Resolves the rotation family a refresh token belongs to.
     *
     * <p>Lets "sign out my other devices" spare the caller's own session: the client presents
     * the token it is holding and the family it maps to is the one kept alive. Returns null for
     * an unrecognised token, which simply means nothing is spared.
     */
    public UUID resolveFamilyId(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) return null;
        try {
            return refreshTokenRepository.findByIdWithUser(UUID.fromString(refreshToken))
                    .map(RefreshTokenEntity::getFamilyId)
                    .orElse(null);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** Records the sign-in against the login history. Exposed for non-password flows. */
    public void recordLogin(UserEntity user, String userAgent) {
        updateLoginData(user, userAgent);
    }

    // ==============================
    // 🔐 INTERNAL
    // ==============================
    private AuthToken generateTokens(UserEntity user, SessionContext context) {

        String accessToken = jwtService.generateToken(user);

        // A new sign-in starts a new family — it is a distinct device from any other.
        RefreshTokenEntity refreshToken = newToken(user, UUID.randomUUID(), context, null);
        refreshToken.setExpiry(Instant.now().plus(refreshTokenTtl));
        refreshToken.setRefreshCount(0);

        refreshTokenRepository.save(refreshToken);

        log.info("Session started for user [{}] (family={}, platform={}, ttl={}d)",
                user.getEmail(), refreshToken.getFamilyId(), context.platform(), refreshTokenTtl.toDays());

        return new AuthToken(
                accessToken,
                refreshToken.getId().toString(),
                refreshToken.getFamilyId(),
                Duration.between(Instant.now(), refreshToken.getExpiry()),
                userMapper.toDto(user)
        );
    }

    /**
     * Builds an unsaved token row. Device metadata comes from the current request when there is
     * one; on rotation the client may not resend it, so anything missing is inherited from the
     * token being replaced rather than blanked out.
     */
    private RefreshTokenEntity newToken(UserEntity user, UUID familyId,
                                        SessionContext context, RefreshTokenEntity previous) {
        RefreshTokenEntity token = new RefreshTokenEntity();
        token.setUser(user);
        token.setFamilyId(familyId);
        token.setPlatform(context.platform());
        token.setUserAgent(truncate(firstNonBlank(
                context.userAgent(), previous == null ? null : previous.getUserAgent()), 512));
        token.setIpAddress(truncate(firstNonBlank(
                context.ipAddress(), previous == null ? null : previous.getIpAddress()), 64));
        token.setLastUsed(Instant.now());
        return token;
    }

    private void updateLoginData(UserEntity user, String userAgent) {

        LoginDataDto loginData = loginDataService.addAgentByUserId(userAgent, user.getUserId());

        Long total = loginDataService.totalNumberOfLogin(user.getUserId());

        log.info("User [{}] logged in via [{}], total logins={}",
                user.getEmail(), userAgent, total);
    }

    private UUID parseToken(String token) {
        try {
            return UUID.fromString(token);
        } catch (Exception e) {
            log.warn("Refresh token parse failed (token ref={}): {}", tokenRef(token), e.getMessage());
            throw new BadCredentialsException("Invalid refresh token");
        }
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank() && !"unknown".equalsIgnoreCase(a)) return a;
        return b;
    }

    private static String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }

    /** Mask a token for logging — first 8 chars + ellipsis. */
    private static String tokenRef(String token) {
        if (token == null) return "<null>";
        if (token.isBlank()) return "<blank>";
        return token.length() > 8 ? token.substring(0, 8) + "..." : token + "...";
    }
}
