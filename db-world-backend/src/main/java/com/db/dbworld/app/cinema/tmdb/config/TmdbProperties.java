package com.db.dbworld.app.cinema.tmdb.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "tmdb")
public class TmdbProperties {

    private String baseUrl;
    private String bearerToken;
    private String apiKey;

    /** Alternate hosts (same path) switched to when the active host keeps resetting connections. */
    private List<String> fallbackBaseUrls = List.of();

}
