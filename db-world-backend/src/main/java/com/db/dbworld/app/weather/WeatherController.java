package com.db.dbworld.app.weather;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.weather.dto.GeoPlaceDto;
import com.db.dbworld.app.weather.dto.WeatherBundleDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Weather, for everyone.
 *
 * <p>Unauthenticated on purpose: the weather page is a public route, and requiring a token meant an
 * anonymous visitor got a page that rendered and then failed its only request. The API key is not
 * the reason this was ever behind auth — the key stays server-side either way, which is the whole
 * point of the proxy.
 *
 * <p>Either {@code city} or both {@code lat} and {@code lon} must be provided.
 */
@Log4j2
@RestController
@RequestMapping("/api/weather")
@RequiredArgsConstructor
public class WeatherController {

    private final WeatherService service;

    /** GET /api/weather — current conditions, hourly, 5-day outlook and air quality in one payload. */
    @GetMapping
    public ApiResponse<WeatherBundleDto> weather(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lon
    ) {
        log.debug("Weather request city={} hasCoords={}", city, lat != null && lon != null);

        // Coordinates win when both are supplied: they are the more precise answer to "where am I",
        // and the client sends the last-known city alongside them as a fallback.
        if (lat != null && lon != null) {
            return ApiResponse.success(service.bundleByCoords(lat, lon));
        }
        if (city != null && !city.isBlank()) {
            return ApiResponse.success(service.bundleByCity(city));
        }
        log.warn("Weather request rejected: missing both city and coords");
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pass either ?city= or ?lat=&lon=");
    }

    /** GET /api/weather/search?q= — place suggestions for the city search box. */
    @GetMapping("/search")
    public ApiResponse<List<GeoPlaceDto>> search(@RequestParam String q) {
        log.debug("Weather place search q={}", q);
        return ApiResponse.success(service.search(q));
    }
}
