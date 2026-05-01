package com.db.dbworld.app.cinema.tmdb.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "tmdb")
public class TmdbProperties {

    private String baseUrl;
    private String bearerToken;
    private String apiKey;

}
