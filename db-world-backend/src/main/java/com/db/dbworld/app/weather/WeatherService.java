package com.db.dbworld.app.weather;

import tools.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Server-side proxy for OpenWeatherMap. Hides the API key (which would otherwise
 * be shipped in the frontend bundle) and caches responses for a few minutes so a
 * burst of refreshes from the UI doesn't burn our quota.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WeatherService {

    private final WeatherProperties props;
    private final RestClient restClient = RestClient.create();

    /** Cache key → (fetchedAt, payload). Bounded implicitly by the small key space. */
    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();

    private record CacheEntry(Instant at, JsonNode payload) {}

    public JsonNode byCity(String city) {
        log.debug("byCity city={}", city);
        if (city == null || city.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "city is required");
        }
        String key = "city:" + city.trim().toLowerCase();
        return cachedOrFetch(key, "/weather?q=" + urlEncode(city.trim()));
    }

    public JsonNode byCoords(double lat, double lon) {
        log.debug("byCoords lat={} lon={}", lat, lon);
        // Round to 3 decimals (~110m) so adjacent requests share a cache slot.
        String key = String.format("coord:%.3f,%.3f", lat, lon);
        return cachedOrFetch(key, String.format("/weather?lat=%s&lon=%s", lat, lon));
    }

    private JsonNode cachedOrFetch(String key, String pathWithQuery) {
        CacheEntry hit = cache.get(key);
        if (hit != null && Duration.between(hit.at(), Instant.now()).getSeconds() < props.getCacheTtlSeconds()) {
            log.debug("Weather cache hit key={}", key);
            return hit.payload();
        }

        if (props.getApiKey() == null || props.getApiKey().isBlank()) {
            log.warn("Weather API key is not configured on the server");
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Weather API key is not configured on the server");
        }

        log.info("Weather cache miss, fetching key={}", key);
        String url = props.getBaseUrl() + pathWithQuery
                + (pathWithQuery.contains("?") ? "&" : "?")
                + "appid=" + props.getApiKey();

        try {
            ResponseEntity<JsonNode> resp = restClient.get().uri(url).retrieve().toEntity(JsonNode.class);
            JsonNode body = resp.getBody();
            if (body == null) {
                log.warn("OpenWeather returned empty body for key={}", key);
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Empty weather response");
            }
            cache.put(key, new CacheEntry(Instant.now(), body));
            log.info("Weather cache refreshed key={}", key);
            return body;
        } catch (HttpClientErrorException.NotFound e) {
            log.warn("OpenWeather not found for key={}: {}", key, e.getMessage());
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "City not found");
        } catch (HttpClientErrorException e) {
            log.warn("OpenWeather upstream error {}: {}", e.getStatusCode(), e.getResponseBodyAsString(), e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Weather upstream error");
        }
    }

    private static String urlEncode(String s) {
        return java.net.URLEncoder.encode(s, java.nio.charset.StandardCharsets.UTF_8);
    }
}
