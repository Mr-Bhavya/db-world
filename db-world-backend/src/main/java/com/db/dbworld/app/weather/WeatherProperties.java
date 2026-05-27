package com.db.dbworld.app.weather;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "weather.openweather")
public class WeatherProperties {

    /** OpenWeatherMap API key — must stay server-side. */
    private String apiKey;

    /** Base URL for OpenWeatherMap's data API. */
    private String baseUrl = "https://api.openweathermap.org/data/2.5";

    /** TTL for cached responses, in seconds. */
    private long cacheTtlSeconds = 300;
}
