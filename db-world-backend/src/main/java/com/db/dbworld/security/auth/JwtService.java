package com.db.dbworld.security.auth;

import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.security.dto.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.jwt.*;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@RequiredArgsConstructor
public class JwtService {

    private final String issuer;
    private final Duration ttl;
    private final JwtEncoder jwtEncoder;
    private final JwtDecoder jwtDecoder;

    public String generateToken(final UserEntity user) {

        final Instant issuedAt = Instant.now();

        final JwtClaimsSet claims = JwtClaimsSet.builder()
                .id(UUID.randomUUID().toString()) // 🔥 important
                .subject(user.getEmail())         // username
                .issuer(issuer)
                .issuedAt(issuedAt)
                .expiresAt(issuedAt.plus(ttl))

                // ✅ custom claims
                .claim("userId", user.getUserId())
                .claim("email", user.getEmail())
                .claim("role", user.getRole().getName().name())

                .build();

        return jwtEncoder.encode(JwtEncoderParameters.from(claims)).getTokenValue();
    }

    public Jwt decode(String token) {
        return jwtDecoder.decode(token);
    }

    public CurrentUser parse(String token) {
        Jwt jwt = jwtDecoder.decode(token);

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

        throw new DbWorldException("Invalid userId type in token");
    }
}