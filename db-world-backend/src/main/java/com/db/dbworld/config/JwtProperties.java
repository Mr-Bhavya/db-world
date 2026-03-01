package com.db.dbworld.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "jwt")
public record JwtProperties(
        String publicKey,
        String privateKey,
        String publicKeyPath,
        String privateKeyPath,
        Duration accessTokenTtl,
        Duration refreshTokenTtl
) {}
