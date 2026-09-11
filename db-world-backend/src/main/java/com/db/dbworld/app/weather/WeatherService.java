package com.db.dbworld.app.weather;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.weather.client.WeatherHttpClient;
import com.db.dbworld.app.weather.client.WeatherUpstreamException;
import com.db.dbworld.app.weather.dto.GeoPlaceDto;
import com.db.dbworld.app.weather.dto.WeatherBundleDto;
import com.db.dbworld.app.weather.dto.WeatherBundleDto.AirQualityDto;
import com.db.dbworld.app.weather.dto.WeatherBundleDto.ConditionDto;
import com.db.dbworld.app.weather.dto.WeatherBundleDto.CurrentDto;
import com.db.dbworld.app.weather.dto.WeatherBundleDto.DayDto;
import com.db.dbworld.app.weather.dto.WeatherBundleDto.HourDto;
import com.db.dbworld.app.weather.dto.WeatherBundleDto.PlaceDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Server-side proxy for OpenWeather.
 *
 * <p>Two jobs. It hides the API key, which would otherwise ship in the frontend bundle. And it
 * assembles the page's three upstream calls — current conditions, the 5-day/3-hour forecast and
 * air quality — into {@link WeatherBundleDto}, converting units and folding the forecast into
 * local calendar days once on the server rather than in every client.
 *
 * <p>Responses are cached for a few minutes ({@code weather.openweather.cache-ttl-seconds}), which
 * matters more than it used to: this endpoint is reachable without a token, so the cache is what
 * stands between an anonymous crawler and our upstream quota.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WeatherService {

    /**
     * Cache ceiling. The geocoding key space is whatever anyone types into the search box, so on a
     * public endpoint an unbounded map is a slow memory leak — LRU eviction bounds it. 500 entries
     * is far more than the handful of places a real user cycles through.
     */
    private static final int MAX_CACHE_ENTRIES = 500;

    /** OpenWeather returns at most 40 three-hour slots; the UI strip only ever shows the near ones. */
    private static final int MAX_HOURLY = 24;
    private static final int MAX_DAILY = 6;
    private static final int MAX_SEARCH_RESULTS = 6;
    private static final int MAX_QUERY_LENGTH = 80;

    /** OpenWeather's own 1-5 air-quality scale. Index 0 is unused so the AQI reads as its own index. */
    private static final String[] AQI_LABELS = {"Unknown", "Good", "Fair", "Moderate", "Poor", "Very Poor"};

    /** Pollutants surfaced by the UI, in the order it lists them. */
    private static final List<String> POLLUTANTS = List.of("pm2_5", "pm10", "o3", "no2", "so2", "co", "nh3", "no");

    private final WeatherProperties props;
    private final SettingsService settings;
    private final WeatherHttpClient http;

    private record CacheEntry(Instant at, Object payload) {}

    /**
     * Access-ordered LRU. {@code synchronizedMap} rather than a {@code ConcurrentHashMap} because
     * {@code LinkedHashMap}'s access ordering mutates on read, so even lookups need the lock.
     */
    private final Map<String, CacheEntry> cache = Collections.synchronizedMap(
            new LinkedHashMap<>(64, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, CacheEntry> eldest) {
                    return size() > MAX_CACHE_ENTRIES;
                }
            });

    // -- Public API -----------------------------------------------------------

    /** Everything the weather page needs for a named city. */
    public WeatherBundleDto bundleByCity(String city) {
        String q = requireQuery(city, "city");
        return cached("bundle:city:" + q.toLowerCase(Locale.ROOT), () -> bundle("q=" + encode(q)));
    }

    /** Everything the weather page needs for a coordinate pair. */
    public WeatherBundleDto bundleByCoords(double lat, double lon) {
        requireCoords(lat, lon);
        // Rounded to 3 decimals (~110 m) so a drifting GPS fix keeps hitting the same cache slot.
        String key = String.format(Locale.ROOT, "bundle:coord:%.3f,%.3f", lat, lon);
        return cached(key, () -> bundle(String.format("lat=%s&lon=%s", lat, lon)));
    }

    /** Geocoding hits for the city search box. */
    public List<GeoPlaceDto> search(String query) {
        String q = requireQuery(query, "q");
        return cached("geo:" + q.toLowerCase(Locale.ROOT), () -> {
            JsonNode results = get(props.getGeoUrl() + "/direct?limit=" + MAX_SEARCH_RESULTS + "&q=" + encode(q));
            List<GeoPlaceDto> places = new ArrayList<>();
            for (JsonNode node : results) {
                places.add(new GeoPlaceDto(
                        node.path("name").asText(""),
                        node.has("state") ? node.path("state").asText("") : null,
                        node.path("country").asText(""),
                        node.path("lat").asDouble(0),
                        node.path("lon").asDouble(0)));
            }
            return List.copyOf(places);
        });
    }

    // -- Assembly -------------------------------------------------------------

    /**
     * Current conditions are required; the forecast and air quality are not.
     *
     * <p>A page showing today's temperature with no outlook is worth far more than an error, so a
     * failure on either supporting call is logged and dropped rather than propagated. Both are
     * looked up by the coordinates the current-conditions response resolved, which also means a
     * city-name lookup only pays for geocoding once.
     */
    private WeatherBundleDto bundle(String locationQuery) {
        JsonNode current = get(props.getBaseUrl() + "/weather?units=metric&" + locationQuery);

        double lat = current.path("coord").path("lat").asDouble(0);
        double lon = current.path("coord").path("lon").asDouble(0);
        int tz = current.path("timezone").asInt(0);

        PlaceDto place = new PlaceDto(
                current.path("name").asText(""),
                current.path("sys").path("country").asText(""),
                lat, lon, tz);

        List<HourDto> hourly = List.of();
        List<DayDto> daily = List.of();
        JsonNode forecast = tryGet(props.getBaseUrl()
                + String.format("/forecast?units=metric&lat=%s&lon=%s", lat, lon), "forecast");
        if (forecast != null) {
            // The forecast payload carries its own offset; prefer it, since it is the one those
            // slot timestamps were produced against.
            int forecastTz = forecast.path("city").path("timezone").asInt(tz);
            hourly = readHourly(forecast);
            daily = foldDaily(forecast, forecastTz);
        }

        JsonNode air = tryGet(props.getBaseUrl()
                + String.format("/air_pollution?lat=%s&lon=%s", lat, lon), "air quality");

        return new WeatherBundleDto(place, readCurrent(current), hourly, daily, readAir(air));
    }

    private CurrentDto readCurrent(JsonNode node) {
        JsonNode main = node.path("main");
        JsonNode wind = node.path("wind");
        JsonNode sys = node.path("sys");

        return new CurrentDto(
                round1(main.path("temp").asDouble(0)),
                round1(main.path("feels_like").asDouble(0)),
                round1(main.path("temp_min").asDouble(0)),
                round1(main.path("temp_max").asDouble(0)),
                main.path("humidity").asInt(0),
                main.path("pressure").asInt(0),
                round1(wind.path("speed").asDouble(0)),
                wind.path("deg").asInt(0),
                wind.has("gust") ? round1(wind.path("gust").asDouble(0)) : null,
                node.has("visibility") ? node.path("visibility").asInt(0) : null,
                node.path("clouds").path("all").asInt(0),
                node.path("dt").asLong(0),
                sys.has("sunrise") ? sys.path("sunrise").asLong(0) : null,
                sys.has("sunset") ? sys.path("sunset").asLong(0) : null,
                readCondition(node));
    }

    private List<HourDto> readHourly(JsonNode forecast) {
        List<HourDto> hours = new ArrayList<>();
        for (JsonNode slot : forecast.path("list")) {
            if (hours.size() == MAX_HOURLY) break;
            JsonNode main = slot.path("main");
            hours.add(new HourDto(
                    slot.path("dt").asLong(0),
                    round1(main.path("temp").asDouble(0)),
                    round1(main.path("feels_like").asDouble(0)),
                    toPercent(slot.path("pop").asDouble(0)),
                    round1(slot.path("wind").path("speed").asDouble(0)),
                    main.path("humidity").asInt(0),
                    readCondition(slot)));
        }
        return List.copyOf(hours);
    }

    /**
     * Folds the 3-hour slots into local calendar days.
     *
     * <p>Grouping uses the location's own UTC offset, not the server's: a slot at 23:00 in Pune is
     * a different day from the same instant read in London, and the reader means their own day.
     */
    private List<DayDto> foldDaily(JsonNode forecast, int timezoneOffsetSeconds) {
        ZoneOffset zone = ZoneOffset.ofTotalSeconds(timezoneOffsetSeconds);
        Map<LocalDate, List<JsonNode>> byDay = new LinkedHashMap<>();

        for (JsonNode slot : forecast.path("list")) {
            LocalDate date = Instant.ofEpochSecond(slot.path("dt").asLong(0)).atOffset(zone).toLocalDate();
            byDay.computeIfAbsent(date, unused -> new ArrayList<>()).add(slot);
        }

        List<DayDto> days = new ArrayList<>();
        for (Map.Entry<LocalDate, List<JsonNode>> entry : byDay.entrySet()) {
            if (days.size() == MAX_DAILY) break;
            days.add(foldDay(entry.getKey(), entry.getValue(), zone));
        }
        return List.copyOf(days);
    }

    private DayDto foldDay(LocalDate date, List<JsonNode> slots, ZoneOffset zone) {
        double min = Double.MAX_VALUE;
        double max = -Double.MAX_VALUE;
        double pop = 0;
        double windSum = 0;
        double humiditySum = 0;

        for (JsonNode slot : slots) {
            JsonNode main = slot.path("main");
            double temp = main.path("temp").asDouble(0);
            min = Math.min(min, main.path("temp_min").asDouble(temp));
            max = Math.max(max, main.path("temp_max").asDouble(temp));
            pop = Math.max(pop, slot.path("pop").asDouble(0));
            windSum += slot.path("wind").path("speed").asDouble(0);
            humiditySum += main.path("humidity").asInt(0);
        }

        return new DayDto(
                date,
                round1(min),
                round1(max),
                toPercent(pop),
                round1(windSum / slots.size()),
                (int) Math.round(humiditySum / slots.size()),
                readCondition(middaySlot(slots, zone)));
    }

    /**
     * The slot nearest local midday. A day's icon should be the one someone would describe if asked
     * what Thursday is like — picking the first slot would label a whole day by its 03:00 sky.
     */
    private JsonNode middaySlot(List<JsonNode> slots, ZoneOffset zone) {
        return slots.stream()
                .min(Comparator.comparingInt(slot -> {
                    int hour = Instant.ofEpochSecond(slot.path("dt").asLong(0)).atOffset(zone).getHour();
                    return Math.abs(hour - 12);
                }))
                .orElseGet(slots::getFirst);
    }

    private ConditionDto readCondition(JsonNode node) {
        JsonNode weather = node.path("weather").path(0);
        return new ConditionDto(
                weather.path("id").asInt(0),
                weather.path("main").asText(""),
                weather.path("description").asText(""),
                weather.path("icon").asText(""));
    }

    private AirQualityDto readAir(JsonNode node) {
        if (node == null) return null;

        JsonNode first = node.path("list").path(0);
        if (first.isMissingNode()) return null;

        int aqi = first.path("main").path("aqi").asInt(0);
        JsonNode raw = first.path("components");
        Map<String, Double> components = new LinkedHashMap<>();
        for (String pollutant : POLLUTANTS) {
            if (raw.has(pollutant)) components.put(pollutant, round1(raw.path(pollutant).asDouble(0)));
        }

        String label = aqi > 0 && aqi < AQI_LABELS.length ? AQI_LABELS[aqi] : AQI_LABELS[0];
        return new AirQualityDto(aqi, label, Map.copyOf(components));
    }

    // -- HTTP and cache plumbing ----------------------------------------------

    /** Required call: a failure here fails the request. */
    private JsonNode get(String urlWithoutKey) {
        if (props.getApiKey() == null || props.getApiKey().isBlank()) {
            log.warn("Weather API key is not configured on the server");
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Weather is not configured on the server");
        }
        try {
            return http.getJson(withKey(urlWithoutKey));
        } catch (WeatherUpstreamException e) {
            if (e.notFound()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Location not found");
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Weather service is unavailable");
        }
    }

    /** Best-effort call: a failure degrades that section to {@code null}. */
    private JsonNode tryGet(String urlWithoutKey, String what) {
        try {
            return get(urlWithoutKey);
        } catch (ResponseStatusException e) {
            log.warn("Weather {} unavailable, continuing without it: {}", what, e.getReason());
            return null;
        }
    }

    /** Appends the key at the last moment so no caller ever holds - or logs - a URL containing it. */
    private String withKey(String url) {
        return url + (url.contains("?") ? "&" : "?") + "appid=" + props.getApiKey();
    }

    @SuppressWarnings("unchecked")
    private <T> T cached(String key, Supplier<T> loader) {
        CacheEntry hit = cache.get(key);
        long ttl = settings.getInt(ConfigKeys.WEATHER_CACHE_TTL_SECONDS);
        if (hit != null && Duration.between(hit.at(), Instant.now()).toSeconds() < ttl) {
            log.debug("Weather cache hit key={}", key);
            return (T) hit.payload();
        }

        log.debug("Weather cache miss key={}", key);
        T value = loader.get();
        cache.put(key, new CacheEntry(Instant.now(), value));
        return value;
    }

    // -- Input handling -------------------------------------------------------

    /**
     * Public endpoint, so the query is untrusted: length is capped before it reaches the cache key
     * or the upstream URL.
     */
    private static String requireQuery(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " is required");
        }
        String trimmed = value.trim();
        if (trimmed.length() > MAX_QUERY_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " is too long");
        }
        return trimmed;
    }

    private static void requireCoords(double lat, double lon) {
        if (Double.isNaN(lat) || Double.isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "lat/lon are out of range");
        }
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    /** OpenWeather reports probability of precipitation as 0-1. */
    private static int toPercent(double fraction) {
        return (int) Math.round(Math.max(0, Math.min(1, fraction)) * 100);
    }
}
