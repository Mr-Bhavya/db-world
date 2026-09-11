package com.db.dbworld.security.google;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(GoogleAuthProperties.class)
public class GoogleAuthConfig {

    /**
     * Always registered, even with no client ids configured, so the sign-in endpoint can
     * answer with a clear "not configured" instead of failing to start or 404-ing. The
     * underlying decoder fetches Google's keys lazily, so an unconfigured server makes no
     * outbound call.
     */
    @Bean
    GoogleIdTokenVerifier googleIdTokenVerifier(final GoogleAuthProperties properties) {
        return new GoogleIdTokenVerifier(properties);
    }
}
