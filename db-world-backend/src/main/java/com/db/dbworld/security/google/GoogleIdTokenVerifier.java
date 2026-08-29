package com.db.dbworld.security.google;

import com.db.dbworld.core.exception.DbWorldException;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

import java.util.List;

/**
 * Verifies a Google ID token and extracts the identity it asserts.
 *
 * <p>Built on the {@code oauth2-resource-server} machinery already on the classpath, so this
 * needs no Google SDK: Nimbus fetches and caches Google's JWKS and checks the RSA signature,
 * and the validators below check who the token was issued by and who it was issued FOR.
 *
 * <p>The audience check is the one that matters most. A signature check alone only proves
 * Google minted the token — not that it was minted for us. Without it, anyone could take an
 * ID token their own app obtained for the same user and replay it here to sign in as them.
 */
@Log4j2
public class GoogleIdTokenVerifier {

    private final NimbusJwtDecoder decoder;
    private final boolean enabled;

    public GoogleIdTokenVerifier(final GoogleAuthProperties properties) {
        this.enabled = properties.isEnabled();

        this.decoder = NimbusJwtDecoder
                .withJwkSetUri(properties.resolvedJwkSetUri())
                .build();

        this.decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefault(),                       // exp / nbf
                issuerValidator(properties.resolvedIssuers()),
                audienceValidator(properties.resolvedClientIds())));

        if (!enabled) {
            log.warn("Google Sign-In is DISABLED — no google.auth.client-ids configured.");
        } else {
            log.info("Google Sign-In enabled for {} client id(s)",
                    properties.resolvedClientIds().size());
        }
    }

    public boolean isEnabled() {
        return enabled;
    }

    /**
     * Verifies the token and returns the identity it asserts.
     *
     * @throws DbWorldException if the token is invalid, or if Google has not verified the
     *                          mailbox. An unverified email must never be trusted for account
     *                          matching: it would let someone claim an address they do not own
     *                          and, through auto-linking, take over the matching account.
     */
    public GoogleIdentity verify(final String idToken) {
        if (!enabled) {
            throw new DbWorldException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Google Sign-In is not configured on this server");
        }
        if (idToken == null || idToken.isBlank()) {
            throw new DbWorldException(HttpStatus.UNAUTHORIZED, "Missing Google ID token");
        }

        final Jwt jwt;
        try {
            jwt = decoder.decode(idToken);
        } catch (JwtException e) {
            log.warn("Google ID token rejected: {}", e.getMessage());
            throw new DbWorldException(HttpStatus.UNAUTHORIZED, "Google sign-in failed: the token could not be verified");
        }

        final String subject = jwt.getSubject();
        if (subject == null || subject.isBlank()) {
            throw new DbWorldException(HttpStatus.UNAUTHORIZED, "Google sign-in failed: token has no subject");
        }

        final String email = jwt.getClaimAsString("email");
        if (email == null || email.isBlank()) {
            throw new DbWorldException(HttpStatus.UNAUTHORIZED, "Google sign-in failed: token carries no email address");
        }

        final boolean emailVerified = Boolean.TRUE.equals(jwt.getClaim("email_verified"))
                || "true".equalsIgnoreCase(jwt.getClaimAsString("email_verified"));
        if (!emailVerified) {
            log.warn("Google ID token rejected: email {} is not verified", email);
            throw new DbWorldException(HttpStatus.UNAUTHORIZED,
                    "Google has not verified this email address, so it cannot be used to sign in");
        }

        return new GoogleIdentity(
                subject,
                email.toLowerCase(),
                true,
                jwt.getClaimAsString("name"),
                jwt.getClaimAsString("given_name"),
                jwt.getClaimAsString("family_name"),
                jwt.getClaimAsString("picture"));
    }

    private static OAuth2TokenValidator<Jwt> issuerValidator(final List<String> issuers) {
        return jwt -> issuers.contains(jwt.getIssuer() == null ? null : jwt.getIssuer().toString())
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error(
                        "invalid_issuer", "ID token was not issued by Google", null));
    }

    private static OAuth2TokenValidator<Jwt> audienceValidator(final List<String> clientIds) {
        return jwt -> {
            final List<String> audience = jwt.getAudience();
            if (audience != null && audience.stream().anyMatch(clientIds::contains)) {
                return OAuth2TokenValidatorResult.success();
            }
            return OAuth2TokenValidatorResult.failure(new OAuth2Error(
                    "invalid_audience", "ID token was not issued for this application", null));
        };
    }
}
