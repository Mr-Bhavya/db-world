package com.db.dbworld.security.auth;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Rejects access tokens minted before the user's token version was last bumped.
 *
 * <p>Plugged into the {@code JwtDecoder} rather than written as a servlet filter so a stale
 * token fails the same way an expired or badly signed one does — a clean 401 through the
 * existing {@code BearerTokenAuthenticationEntryPoint}, with no separate error path to keep
 * in sync.
 *
 * <p>Tokens issued before this feature existed carry no {@code tv} claim. Those are accepted
 * while they live out their remaining minutes, because rejecting them would sign every active
 * user out on deploy for no security gain — the claim only matters once a bump has happened.
 */
@Log4j2
@RequiredArgsConstructor
public class TokenVersionValidator implements OAuth2TokenValidator<Jwt> {

    private static final OAuth2Error STALE = new OAuth2Error(
            "invalid_token",
            "Access token has been revoked",
            null);

    private final TokenVersionService tokenVersionService;

    @Override
    public OAuth2TokenValidatorResult validate(final Jwt jwt) {
        final Object claim = jwt.getClaim(TokenVersionService.CLAIM);
        if (claim == null) {
            return OAuth2TokenValidatorResult.success(); // pre-versioning token, still in its TTL
        }

        final Long userId = asLong(jwt.getClaim("userId"));
        if (userId == null) {
            log.warn("Access token carries a {} claim but no usable userId — rejecting",
                    TokenVersionService.CLAIM);
            return OAuth2TokenValidatorResult.failure(STALE);
        }

        final Integer tokenVersion = asInt(claim);
        if (tokenVersion == null) {
            log.warn("Unparseable {} claim on token for userId={} — rejecting",
                    TokenVersionService.CLAIM, userId);
            return OAuth2TokenValidatorResult.failure(STALE);
        }

        final int current = tokenVersionService.currentVersion(userId);
        if (tokenVersion == current) {
            return OAuth2TokenValidatorResult.success();
        }

        log.info("Rejected stale access token for userId={} (token tv={}, current tv={})",
                userId, tokenVersion, current);
        return OAuth2TokenValidatorResult.failure(STALE);
    }

    private static Long asLong(final Object value) {
        return switch (value) {
            case Long l -> l;
            case Integer i -> i.longValue();
            case String s -> parseLong(s);
            case null, default -> null;
        };
    }

    private static Integer asInt(final Object value) {
        return switch (value) {
            case Integer i -> i;
            case Long l -> l.intValue();
            case String s -> parseInt(s);
            case null, default -> null;
        };
    }

    private static Long parseLong(final String s) {
        try {
            return Long.parseLong(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Integer parseInt(final String s) {
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
