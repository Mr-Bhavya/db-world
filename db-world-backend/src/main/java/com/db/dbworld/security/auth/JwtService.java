package com.db.dbworld.security.auth;

import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.security.dto.CurrentUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.security.oauth2.jwt.*;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Log4j2
@RequiredArgsConstructor
public class JwtService {

    private final String issuer;
    private final Duration ttl;
    private final JwtEncoder jwtEncoder;
    private final JwtDecoder jwtDecoder;

    public String generateToken(final UserEntity user) {
        log.debug("generateToken called for user [{}] (role={})",
                user.getEmail(), user.getRole().getName().name());

        final Instant issuedAt = Instant.now();
        final Instant expiresAt = issuedAt.plus(ttl);

        final JwtClaimsSet claims = JwtClaimsSet.builder()
                .id(UUID.randomUUID().toString()) // 🔥 important
                .subject(user.getEmail())         // username
                .issuer(issuer)
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)

                // ✅ custom claims
                .claim("userId", user.getUserId())
                .claim("email", user.getEmail())
                .claim("role", user.getRole().getName().name())

                .build();

        try {
            String token = jwtEncoder.encode(JwtEncoderParameters.from(claims)).getTokenValue();
            log.info("JWT issued for user [{}] (expiresAt={})", user.getEmail(), expiresAt);
            return token;
        } catch (Exception e) {
            log.error("Failed to encode JWT for user [{}]: {}", user.getEmail(), e.getMessage(), e);
            throw e;
        }
    }

    public Jwt decode(String token) {
        try {
            return jwtDecoder.decode(token);
        } catch (JwtException ex) {
            log.warn("JWT decode failed: {}", ex.getMessage());
            throw ex;
        }
    }

    public CurrentUser parse(String token) {
        Jwt jwt;
        try {
            jwt = jwtDecoder.decode(token);
        } catch (JwtException ex) {
            log.warn("JWT parse failed: {}", ex.getMessage());
            throw ex;
        }

        return new CurrentUser(
                convertToLong(jwt.getClaim("userId")),
                jwt.getClaimAsString("email"),
                jwt.getClaimAsString("role")
        );
    }

    private Long convertToLong(Object value) {
        if (value instanceof Long l) return l;
        if (value instanceof Integer i) return i.longValue();
        if (value instanceof String s) return Long.parseLong(s);

        log.warn("Invalid userId claim type: {}", value == null ? "null" : value.getClass().getName());
        throw new DbWorldException("Invalid userId type in token");
    }
}