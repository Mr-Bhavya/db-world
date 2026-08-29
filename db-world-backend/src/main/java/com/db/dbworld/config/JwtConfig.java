package com.db.dbworld.config;

import com.db.dbworld.security.RsaKeyProvider;
import com.db.dbworld.security.auth.JwtService;
import com.db.dbworld.security.auth.TokenVersionService;
import com.db.dbworld.security.auth.TokenVersionValidator;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.*;

@Configuration
@EnableConfigurationProperties(JwtProperties.class)
public class JwtConfig {

    @Bean
    JwtEncoder jwtEncoder(RsaKeyProvider keys) {
        RSAKey jwk = new RSAKey.Builder(keys.getPublicKey())
                .privateKey(keys.getPrivateKey())
                .build();
        return new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(jwk)));
    }

    /**
     * The decoder also enforces the token version, so a revoked access token fails here
     * rather than in a separate filter — same 401 path as an expired or forged one.
     * {@code createDefault()} keeps the standard expiry/not-before checks in place.
     */
    @Bean
    JwtDecoder jwtDecoder(RsaKeyProvider keys, TokenVersionService tokenVersionService) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withPublicKey(keys.getPublicKey()).build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefault(),
                new TokenVersionValidator(tokenVersionService)));
        return decoder;
    }

    @Bean
    JwtService jwtService(
            JwtProperties props,
            JwtEncoder encoder,
            JwtDecoder decoder,
            @Value("${spring.application.name}") String appName) {

        return new JwtService(appName, props.accessTokenTtl(), encoder, decoder);
    }
}
