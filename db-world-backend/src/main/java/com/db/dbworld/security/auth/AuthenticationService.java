package com.db.dbworld.services.auth;

import static java.time.Duration.between;

import com.db.dbworld.dao.user.RefreshTokenRepository;
import com.db.dbworld.entities.user.RefreshTokenEntity;
import com.db.dbworld.entities.user.UserEntity;
import com.db.dbworld.helpers.DbWorldRecords;
import com.db.dbworld.payloads.user.LoginDataDto;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import com.db.dbworld.services.user.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;

@Log4j2
@Service
@RequiredArgsConstructor
public class AuthenticationService {

//    @Value("${jwt.token.refresh-token-ttl}")
    private final Duration refreshTokenTtl = Duration.ofDays(30);

    private final AuthenticationManager authenticationManager;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private LoginDataService loginDataService;

    @Autowired
    private UserService userService;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    public DbWorldRecords.AuthTokens authenticate(final String userAgent, final String username, final String password) {
        final var authToken = UsernamePasswordAuthenticationToken.unauthenticated(username, password);
        authenticationManager.authenticate(authToken);
        UserEntity user = userService.getUserEntityByEmail(username);
        DbWorldRecords.AuthTokens authTokens = authenticate(user);
        updateUserLoginDetail(user, userAgent);
        return authTokens;
    }

    public DbWorldRecords.AuthTokens refreshToken(final String refreshToken) {
        final var refreshTokenEntity = refreshTokenRepository.findByIdAndExpiryAfter(validateRefreshTokenFormat(refreshToken), Instant.now())
                .orElseThrow(() -> new BadCredentialsException("Invalid or expired refresh token"));

        final var newAccessToken = jwtService.generateToken(refreshTokenEntity.getUser());

        return new DbWorldRecords.AuthTokens(newAccessToken, refreshToken, between(Instant.now(), refreshTokenEntity.getExpiry()), refreshTokenEntity.getUser());
    }

    public void revokeRefreshToken(String refreshToken) {
        refreshTokenRepository.deleteById(validateRefreshTokenFormat(refreshToken));
    }

    private DbWorldRecords.AuthTokens authenticate(final UserEntity user) {
        final var accessToken = jwtService.generateToken(user);

        RefreshTokenEntity refreshTokenEntity = new RefreshTokenEntity();
        refreshTokenEntity.setUser(user);
        refreshTokenEntity.setExpiry(Instant.now().plus(refreshTokenTtl));
        refreshTokenRepository.save(refreshTokenEntity);

        return new DbWorldRecords.AuthTokens(accessToken, refreshTokenEntity.getId().toString(), between(Instant.now(), refreshTokenEntity.getExpiry()), user);
    }

    private void updateUserLoginDetail(UserEntity user, String userAgent){
        LoginDataDto newLoginData = this.loginDataService.addAgentByUserId(userAgent, user.getUserId());
        Long totalNumberOfLogin = this.loginDataService.totalNumberOfLogin(user.getUserId());
        log.info("***** User [{}] is logged in using [{}]. Total No Of Login: {} *****", user.getEmail(), userAgent, totalNumberOfLogin);
    }

    private UUID validateRefreshTokenFormat(final String refreshToken) {
        try {
            return UUID.fromString(refreshToken);
        } catch (IllegalArgumentException e) {
            throw new BadCredentialsException("Invalid or expired refresh token");
        }
    }

}
