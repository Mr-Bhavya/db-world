package com.db.dbworld.security.auth;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The check that makes revocation immediate. If this validator ever silently passes a stale
 * token, a demoted admin keeps admin access for the rest of that token's life — so the "reject"
 * cases matter more here than the happy path.
 */
class TokenVersionValidatorTest {

    private final TokenVersionService tokenVersionService = mock(TokenVersionService.class);
    private final TokenVersionValidator validator = new TokenVersionValidator(tokenVersionService);

    private static Jwt jwtWith(Map<String, Object> claims) {
        return new Jwt("token-value",
                Instant.now(), Instant.now().plusSeconds(300),
                Map.of("alg", "RS256"),
                claims);
    }

    @Test
    void acceptsTokenWhoseVersionMatches() {
        when(tokenVersionService.currentVersion(7L)).thenReturn(3);

        OAuth2TokenValidatorResult result =
                validator.validate(jwtWith(Map.of("userId", 7L, "tv", 3)));

        assertThat(result.hasErrors()).isFalse();
    }

    @Test
    void rejectsTokenMintedBeforeTheVersionWasBumped() {
        when(tokenVersionService.currentVersion(7L)).thenReturn(4);

        OAuth2TokenValidatorResult result =
                validator.validate(jwtWith(Map.of("userId", 7L, "tv", 3)));

        assertThat(result.hasErrors()).isTrue();
        assertThat(result.getErrors()).anySatisfy(e ->
                assertThat(e.getDescription()).contains("revoked"));
    }

    /**
     * Tokens issued before this feature shipped carry no tv claim. Rejecting them would sign
     * every active user out on deploy for no security benefit — the claim only starts mattering
     * once a bump has actually happened.
     */
    @Test
    void acceptsLegacyTokenWithNoVersionClaim() {
        assertThat(validator.validate(jwtWith(Map.of("userId", 7L))).hasErrors()).isFalse();
    }

    @Test
    void rejectsTokenCarryingAVersionButNoUsableUserId() {
        assertThat(validator.validate(jwtWith(Map.of("tv", 3))).hasErrors()).isTrue();
    }

    /** A deleted user resolves to -1, which can never equal a real claim, so the token dies. */
    @Test
    void rejectsTokenForAUserThatNoLongerExists() {
        when(tokenVersionService.currentVersion(99L)).thenReturn(-1);

        assertThat(validator.validate(jwtWith(Map.of("userId", 99L, "tv", 0))).hasErrors()).isTrue();
    }

    /** Nimbus hands numeric claims back as Integer or Long depending on size — both must work. */
    @Test
    void toleratesNumericClaimsArrivingAsEitherIntegerOrLong() {
        when(tokenVersionService.currentVersion(7L)).thenReturn(2);

        assertThat(validator.validate(jwtWith(Map.of("userId", 7, "tv", 2L))).hasErrors()).isFalse();
        assertThat(validator.validate(jwtWith(Map.of("userId", 7L, "tv", 2))).hasErrors()).isFalse();
    }
}
