package com.db.dbworld.app.weather;

import com.db.dbworld.api.response.ApiResponse;
import tools.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

/**
 * Authenticated weather endpoint — the frontend used to call OpenWeatherMap
 * directly with the API key in the bundle. This proxies the same data so the
 * key stays on the server.
 *
 * Either {@code city} or both {@code lat} and {@code lon} must be provided.
 */
@Log4j2
@RestController
@RequestMapping("/api/weather")
@RequiredArgsConstructor
public class WeatherController {

    private final WeatherService service;

    @GetMapping
    public ApiResponse<JsonNode> get(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lon
    ) {
        log.debug("Weather request city={} lat={} lon={}", city, lat, lon);
        if (city != null && !city.isBlank()) {
            return ApiResponse.success(service.byCity(city));
        }
        if (lat != null && lon != null) {
            return ApiResponse.success(service.byCoords(lat, lon));
        }
        log.warn("Weather request rejected: missing both city and coords");
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Pass either ?city= or ?lat=&lon=");
    }
}
