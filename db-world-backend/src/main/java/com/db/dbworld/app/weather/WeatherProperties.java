package com.db.dbworld.app.weather;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Startup-bound OpenWeather connection details (stay in YAML). */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "weather.openweather")
public class WeatherProperties {
    private String apiKey;
    private String baseUrl = "https://api.openweathermap.org/data/2.5";
    /**
     * Geocoding lives on its own version line, not under {@code /data/2.5}, so it needs a second
     * base rather than a path appended to {@link #baseUrl}.
     */
    private String geoUrl = "https://api.openweathermap.org/geo/1.0";
}
