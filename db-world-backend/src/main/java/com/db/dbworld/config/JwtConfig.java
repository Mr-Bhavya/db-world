package com.db.dbworld.config;

import com.db.dbworld.security.RsaKeyProvider;
import com.db.dbworld.security.auth.JwtService;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
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

    @Bean
    JwtDecoder jwtDecoder(RsaKeyProvider keys) {
        return NimbusJwtDecoder.withPublicKey(keys.getPublicKey()).build();
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
