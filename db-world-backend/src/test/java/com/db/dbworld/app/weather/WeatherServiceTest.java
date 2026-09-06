package com.db.dbworld.app.weather;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.weather.client.WeatherHttpClient;
import com.db.dbworld.app.weather.client.WeatherUpstreamException;
import com.db.dbworld.app.weather.dto.GeoPlaceDto;
import com.db.dbworld.app.weather.dto.WeatherBundleDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WeatherServiceTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** IST, +5:30. Deliberately not UTC — day folding is only interesting off the zero meridian. */
    private static final int IST = 19800;

    @Mock
    private WeatherHttpClient http;

    @Mock
    private SettingsService settings;

    private WeatherProperties props;
    private WeatherService service;

    @BeforeEach
    void setUp() {
        props = new WeatherProperties();
        props.setApiKey("test-key");
        props.setBaseUrl("https://ow/data/2.5");
        props.setGeoUrl("https://ow/geo/1.0");

        when(settings.getInt(ConfigKeys.WEATHER_CACHE_TTL_SECONDS)).thenReturn(300);

        service = new WeatherService(props, settings, http);
    }

    // -- Assembly -------------------------------------------------------------

    @Test
    void bundleCombinesCurrentForecastAndAirQuality() {
        stubHappyPath();

        WeatherBundleDto bundle = service.bundleByCity("Pune");

        assertThat(bundle.place().name()).isEqualTo("Pune");
        assertThat(bundle.place().country()).isEqualTo("IN");
        assertThat(bundle.place().lat()).isEqualTo(18.52);
        assertThat(bundle.place().timezoneOffsetSeconds()).isEqualTo(IST);

        assertThat(bundle.current().tempC()).isEqualTo(25.5);
        assertThat(bundle.current().feelsLikeC()).isEqualTo(25.4);
        assertThat(bundle.current().humidity()).isEqualTo(52);
        assertThat(bundle.current().windGustMs()).isEqualTo(10.5);
        assertThat(bundle.current().visibilityM()).isEqualTo(10000);
        assertThat(bundle.current().condition().description()).isEqualTo("broken clouds");

        assertThat(bundle.hourly()).hasSize(5);
        assertThat(bundle.air().aqi()).isEqualTo(2);
        assertThat(bundle.air().label()).isEqualTo("Fair");
        assertThat(bundle.air().components()).containsEntry("pm2_5", 2.6);
    }

    @Test
    void apiKeyIsAppendedButNeverBakedIntoTheCallerVisibleUrl() {
        stubHappyPath();

        service.bundleByCity("Pune");

        verify(http).getJson("https://ow/data/2.5/weather?units=metric&q=Pune&appid=test-key");
    }

    @Test
    void cityQueryIsUrlEncoded() {
        stubHappyPath();

        service.bundleByCity("New York");

        verify(http).getJson(contains("q=New+York"));
    }

    @Test
    void coordinatesAreQueriedDirectlyWithoutGeocoding() {
        stubHappyPath();

        service.bundleByCoords(18.52, 73.86);

        verify(http).getJson("https://ow/data/2.5/weather?units=metric&lat=18.52&lon=73.86&appid=test-key");
    }

    // -- Daily folding --------------------------------------------------------

    @Test
    void forecastSlotsAreGroupedByTheLocationsLocalDayNotUtc() {
        // 2026-08-29 20:00 and 23:00 UTC are both 2026-08-30 in IST (+5:30). Grouping in UTC would
        // split them across two days and invent a bogus extra entry.
        stubCurrent(IST);
        stubForecast(IST, """
                {"dt": 1787990400, "main": {"temp": 25, "temp_min": 24, "temp_max": 26, "humidity": 50},
                 "wind": {"speed": 4}, "pop": 0.1, "weather": [{"id": 800, "main": "Clear", "description": "clear sky", "icon": "01d"}]},
                {"dt": 1788033600, "main": {"temp": 21, "temp_min": 20, "temp_max": 22, "humidity": 60},
                 "wind": {"speed": 2}, "pop": 0.4, "weather": [{"id": 500, "main": "Rain", "description": "light rain", "icon": "10n"}]},
                {"dt": 1788044400, "main": {"temp": 19, "temp_min": 18, "temp_max": 20, "humidity": 70},
                 "wind": {"speed": 3}, "pop": 0.8, "weather": [{"id": 501, "main": "Rain", "description": "moderate rain", "icon": "10n"}]}
                """);
        stubAir();

        List<WeatherBundleDto.DayDto> daily = service.bundleByCity("Pune").daily();

        assertThat(daily).hasSize(2);
        assertThat(daily.get(0).date()).isEqualTo(LocalDate.of(2026, 8, 29));
        assertThat(daily.get(1).date()).isEqualTo(LocalDate.of(2026, 8, 30));
    }

    @Test
    void dailyTakesTheExtremesTheWorstPopAndTheMeanWind() {
        stubCurrent(IST);
        stubForecast(IST, """
                {"dt": 1788033600, "main": {"temp": 21, "temp_min": 20, "temp_max": 22, "humidity": 60},
                 "wind": {"speed": 2}, "pop": 0.4, "weather": [{"id": 500, "main": "Rain", "description": "light rain", "icon": "10n"}]},
                {"dt": 1788044400, "main": {"temp": 19, "temp_min": 17.4, "temp_max": 31.62, "humidity": 70},
                 "wind": {"speed": 4}, "pop": 0.85, "weather": [{"id": 501, "main": "Rain", "description": "moderate rain", "icon": "10n"}]}
                """);
        stubAir();

        WeatherBundleDto.DayDto day = service.bundleByCity("Pune").daily().getFirst();

        assertThat(day.minC()).isEqualTo(17.4);
        assertThat(day.maxC()).isEqualTo(31.6);
        assertThat(day.popPct()).isEqualTo(85);
        assertThat(day.windSpeedMs()).isEqualTo(3.0);
        assertThat(day.humidity()).isEqualTo(65);
    }

    @Test
    void aDayIsLabelledByItsMiddaySlotNotItsFirst() {
        // 03:00 and 12:00 local on the same IST day. The day should read as the noon sky.
        stubCurrent(IST);
        stubForecast(IST, """
                {"dt": 1788037200, "main": {"temp": 20, "temp_min": 20, "temp_max": 20, "humidity": 60},
                 "wind": {"speed": 2}, "pop": 0.1, "weather": [{"id": 800, "main": "Clear", "description": "clear night", "icon": "01n"}]},
                {"dt": 1788069600, "main": {"temp": 30, "temp_min": 30, "temp_max": 30, "humidity": 40},
                 "wind": {"speed": 3}, "pop": 0.2, "weather": [{"id": 802, "main": "Clouds", "description": "scattered clouds", "icon": "03d"}]}
                """);
        stubAir();

        WeatherBundleDto.DayDto day = service.bundleByCity("Pune").daily().getFirst();

        assertThat(day.date()).isEqualTo(LocalDate.of(2026, 8, 30));
        assertThat(day.condition().description()).isEqualTo("scattered clouds");
    }

    @Test
    void probabilityOfPrecipitationBecomesAPercentage() {
        stubHappyPath();

        assertThat(service.bundleByCity("Pune").hourly().getFirst().popPct()).isEqualTo(5);
    }

    // -- Degradation ----------------------------------------------------------

    @Test
    void aFailedForecastLeavesCurrentConditionsIntact() {
        stubCurrent(IST);
        stubAir();
        when(http.getJson(contains("/forecast"))).thenThrow(new WeatherUpstreamException("boom", false));

        WeatherBundleDto bundle = service.bundleByCity("Pune");

        assertThat(bundle.current().tempC()).isEqualTo(25.5);
        assertThat(bundle.hourly()).isEmpty();
        assertThat(bundle.daily()).isEmpty();
        assertThat(bundle.air()).isNotNull();
    }

    @Test
    void aFailedAirQualityCallLeavesTheRestIntact() {
        stubCurrent(IST);
        stubForecast(IST, minimalSlot());
        when(http.getJson(contains("/air_pollution"))).thenThrow(new WeatherUpstreamException("boom", false));

        WeatherBundleDto bundle = service.bundleByCity("Pune");

        assertThat(bundle.air()).isNull();
        assertThat(bundle.daily()).isNotEmpty();
    }

    @Test
    void aFailedCurrentConditionsCallFailsTheRequest() {
        when(http.getJson(contains("/weather"))).thenThrow(new WeatherUpstreamException("boom", false));

        assertThatThrownBy(() -> service.bundleByCity("Pune"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.BAD_GATEWAY);
    }

    @Test
    void anUnknownCityIsA404NotA502() {
        when(http.getJson(anyString())).thenThrow(new WeatherUpstreamException("nope", true));

        assertThatThrownBy(() -> service.bundleByCity("Atlantis"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void anUnconfiguredApiKeyIsReportedAsUnavailableWithoutCallingUpstream() {
        props.setApiKey("  ");

        assertThatThrownBy(() -> service.bundleByCity("Pune"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        verify(http, never()).getJson(anyString());
    }

    // -- Cache ----------------------------------------------------------------

    @Test
    void aSecondLookupWithinTheTtlIsServedFromCache() {
        stubHappyPath();

        service.bundleByCity("Pune");
        service.bundleByCity("  pune  ");

        verify(http, times(1)).getJson(contains("/weather?"));
    }

    @Test
    void anExpiredEntryIsRefetched() {
        stubHappyPath();
        when(settings.getInt(ConfigKeys.WEATHER_CACHE_TTL_SECONDS)).thenReturn(0);

        service.bundleByCity("Pune");
        service.bundleByCity("Pune");

        verify(http, times(2)).getJson(contains("/weather?"));
    }

    @Test
    void nearbyCoordinatesShareACacheSlot() {
        stubHappyPath();

        service.bundleByCoords(18.5196, 73.8553);
        service.bundleByCoords(18.5197, 73.8551);

        verify(http, times(1)).getJson(contains("/weather?"));
    }

    // -- Search ---------------------------------------------------------------

    @Test
    void searchMapsGeocodingHits() {
        when(http.getJson(contains("/geo/1.0/direct"))).thenReturn(json("""
                [
                  {"name": "London", "lat": 51.5, "lon": -0.12, "country": "GB"},
                  {"name": "London", "lat": 42.98, "lon": -81.24, "country": "CA", "state": "Ontario"}
                ]
                """));

        List<GeoPlaceDto> places = service.search("London");

        assertThat(places).hasSize(2);
        // Most of the world has no state; it stays null rather than becoming an empty label.
        assertThat(places.getFirst().state()).isNull();
        assertThat(places.get(1).state()).isEqualTo("Ontario");
        assertThat(places.get(1).lat()).isEqualTo(42.98);
    }

    @Test
    void searchIsCappedAndEncoded() {
        when(http.getJson(anyString())).thenReturn(json("[]"));

        service.search("New York");

        verify(http).getJson("https://ow/geo/1.0/direct?limit=6&q=New+York&appid=test-key");
    }

    // -- Input validation -----------------------------------------------------

    @Test
    void aBlankCityIsRejected() {
        assertThatThrownBy(() -> service.bundleByCity("   "))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void anAbsurdlyLongQueryIsRejectedBeforeItReachesUpstream() {
        assertThatThrownBy(() -> service.search("x".repeat(200)))
                .isInstanceOf(ResponseStatusException.class);
        verify(http, never()).getJson(anyString());
    }

    @Test
    void outOfRangeCoordinatesAreRejected() {
        assertThatThrownBy(() -> service.bundleByCoords(91, 0)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.bundleByCoords(0, 181)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.bundleByCoords(Double.NaN, 0)).isInstanceOf(ResponseStatusException.class);
        verify(http, never()).getJson(anyString());
    }

    // -- Fixtures -------------------------------------------------------------

    private void stubHappyPath() {
        stubCurrent(IST);
        stubForecast(IST, """
                {"dt": 1787983200, "main": {"temp": 25.44, "temp_min": 25.44, "temp_max": 25.68, "humidity": 54},
                 "wind": {"speed": 7.29}, "pop": 0.05, "weather": [{"id": 803, "main": "Clouds", "description": "broken clouds", "icon": "04d"}]},
                {"dt": 1787994000, "main": {"temp": 24.1, "temp_min": 24.1, "temp_max": 24.4, "humidity": 58},
                 "wind": {"speed": 6.1}, "pop": 0.1, "weather": [{"id": 803, "main": "Clouds", "description": "broken clouds", "icon": "04d"}]},
                {"dt": 1788004800, "main": {"temp": 22.8, "temp_min": 22.8, "temp_max": 23, "humidity": 63},
                 "wind": {"speed": 5.2}, "pop": 0.2, "weather": [{"id": 500, "main": "Rain", "description": "light rain", "icon": "10n"}]},
                {"dt": 1788015600, "main": {"temp": 21.9, "temp_min": 21.9, "temp_max": 22, "humidity": 68},
                 "wind": {"speed": 4.4}, "pop": 0.3, "weather": [{"id": 500, "main": "Rain", "description": "light rain", "icon": "10n"}]},
                {"dt": 1788026400, "main": {"temp": 21.2, "temp_min": 21, "temp_max": 21.4, "humidity": 71},
                 "wind": {"speed": 3.8}, "pop": 0.35, "weather": [{"id": 500, "main": "Rain", "description": "light rain", "icon": "10n"}]}
                """);
        stubAir();
    }

    private void stubCurrent(int timezoneOffsetSeconds) {
        when(http.getJson(contains("/weather?"))).thenReturn(json("""
                {
                  "coord": {"lon": 73.86, "lat": 18.52},
                  "weather": [{"id": 803, "main": "Clouds", "description": "broken clouds", "icon": "04d"}],
                  "main": {"temp": 25.47, "feels_like": 25.43, "temp_min": 24.21, "temp_max": 25.64,
                           "pressure": 1012, "humidity": 52},
                  "visibility": 10000,
                  "wind": {"speed": 7.29, "deg": 271, "gust": 10.45},
                  "clouds": {"all": 74},
                  "dt": 1787982086,
                  "sys": {"country": "IN", "sunrise": 1787964571, "sunset": 1788009733},
                  "timezone": %d,
                  "name": "Pune"
                }
                """.formatted(timezoneOffsetSeconds)));
    }

    private void stubForecast(int timezoneOffsetSeconds, String slots) {
        when(http.getJson(contains("/forecast"))).thenReturn(json("""
                {"list": [%s], "city": {"name": "Pune", "timezone": %d}}
                """.formatted(slots, timezoneOffsetSeconds)));
    }

    private void stubAir() {
        when(http.getJson(contains("/air_pollution"))).thenReturn(json("""
                {"list": [{"main": {"aqi": 2},
                           "components": {"co": 66.06, "no2": 0.3, "o3": 32.92, "so2": 0.18,
                                          "pm2_5": 2.58, "pm10": 4.58, "nh3": 0.17}}]}
                """));
    }

    private static String minimalSlot() {
        return """
                {"dt": 1787983200, "main": {"temp": 25, "temp_min": 25, "temp_max": 25, "humidity": 50},
                 "wind": {"speed": 4}, "pop": 0, "weather": [{"id": 800, "main": "Clear", "description": "clear sky", "icon": "01d"}]}
                """;
    }

    private static JsonNode json(String raw) {
        return MAPPER.readTree(raw);
    }
}
