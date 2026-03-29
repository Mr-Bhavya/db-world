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

        var authToken = UsernamePasswordAuthenticationToken.unauthenticated(email, password);

        authenticationManager.authenticate(authToken);

        UserEntity user = userService.getUserEntityByEmail(email);

        AuthToken tokens = generateTokens(user);

        updateLoginData(user, userAgent);

        return tokens;
    }

    // ==============================
    // 🔄 REFRESH TOKEN
    // ==============================
    public AuthToken refreshToken(String refreshToken) {

        RefreshTokenEntity entity = refreshTokenRepository
                .findByIdAndExpiryAfter(parseToken(refreshToken), Instant.now())
                .orElseThrow(() -> new BadCredentialsException("Invalid or expired refresh token"));

        String newAccessToken = jwtService.generateToken(entity.getUser());

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
        refreshTokenRepository.deleteById(parseToken(refreshToken));
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
            throw new BadCredentialsException("Invalid refresh token");
        }
    }
}