package com.db.dbworld.config;

import org.springframework.boot.context.properties.ConfigurationProperties;


@ConfigurationProperties(prefix = "jasypt.encryptor")
public record JasyptProperties(
        String password,
        String bean,
        String algorithm
) {}
