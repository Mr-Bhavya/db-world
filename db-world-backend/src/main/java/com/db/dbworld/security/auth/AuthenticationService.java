package com.db.dbworld.security.auth;

import com.db.dbworld.security.dto.AuthToken;
import com.db.dbworld.security.repository.RefreshTokenRepository;
import com.db.dbworld.security.entity.RefreshTokenEntity;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.mapper.UserMapper;
import com.db.dbworld.audit.activity.dto.LoginDataDto;
import com.db.dbworld.audit.activity.service.LoginDataService;
import com.db.dbworld.core.user.service.UserService;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;

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
    private final UserMapper userMapper;

    // ==============================
    // ✅ LOGIN
    // ==============================
    public AuthToken authenticate(
            String userAgent,
            String email,
            String password
    ) {
        log.debug("authenticate called for email={} (userAgent={})", email, userAgent);

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

        AuthToken tokens = generateTokens(user);

        updateLoginData(user, userAgent);

        return tokens;
    }

    // ==============================
    // 🔄 REFRESH TOKEN
    // ==============================
    public AuthToken refreshToken(String refreshToken) {
        log.debug("refreshToken called (token ref={})", tokenRef(refreshToken));

        UUID tokenId = parseToken(refreshToken);
        RefreshTokenEntity entity = refreshTokenRepository
                .findByIdAndExpiryAfter(tokenId, Instant.now())
                .orElseThrow(() -> {
                    log.warn("Refresh token rejected: invalid or expired (token ref={})", tokenRef(refreshToken));
                    return new BadCredentialsException("Invalid or expired refresh token");
                });

        String newAccessToken = jwtService.generateToken(entity.getUser());
        log.info("Access token refreshed for user [{}]", entity.getUser().getEmail());

        return new AuthToken(
                newAccessToken,
                refreshToken,
                Duration.between(Instant.now(), entity.getExpiry()),
                userMapper.toDto(entity.getUser())
        );
    }

    // ==============================
    // 🚪 LOGOUT
    // ==============================
    public void revokeRefreshToken(String refreshToken) {
        log.debug("revokeRefreshToken called (token ref={})", tokenRef(refreshToken));
        UUID tokenId = parseToken(refreshToken);
        refreshTokenRepository.deleteById(tokenId);
        log.info("Refresh token revoked (token ref={})", tokenRef(refreshToken));
    }

    // ==============================
    // 🔐 INTERNAL
    // ==============================
    private AuthToken generateTokens(UserEntity user) {

        String accessToken = jwtService.generateToken(user);

        RefreshTokenEntity refreshToken = new RefreshTokenEntity();
        refreshToken.setUser(user);
        refreshToken.setExpiry(Instant.now().plus(refreshTokenTtl));

        refreshTokenRepository.save(refreshToken);

        log.info("Refresh token issued for user [{}], ttl={}d", user.getEmail(), refreshTokenTtl.toDays());

        return new AuthToken(
                accessToken,
                refreshToken.getId().toString(),
                Duration.between(Instant.now(), refreshToken.getExpiry()),
                userMapper.toDto(user)
        );
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

    /** Mask a token for logging — first 8 chars + ellipsis. Returns "<null>" / "<blank>" when absent. */
    private static String tokenRef(String token) {
        if (token == null) return "<null>";
        if (token.isBlank()) return "<blank>";
        return token.length() > 8 ? token.substring(0, 8) + "..." : token + "...";
    }
}