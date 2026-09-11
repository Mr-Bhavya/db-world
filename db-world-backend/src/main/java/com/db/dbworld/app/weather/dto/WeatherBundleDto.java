package com.db.dbworld.app.weather.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Everything the weather page renders, in one payload.
 *
 * <p>The page needs current conditions, a short-term outlook, a multi-day outlook and air
 * quality — three separate OpenWeather calls. Fanning those out from the browser would mean three
 * round trips over the user's connection and three chances to half-render; the server makes them
 * once, caches the result and hands back a single shape.
 *
 * <p>Units are already resolved here (Celsius, m/s, percent) rather than left as Kelvin for the
 * client to convert, and the 3-hour forecast is already folded into local-calendar days. Doing it
 * once on the server keeps the same arithmetic out of both the page and the home widget.
 *
 * <p>{@code hourly}, {@code daily} and {@code air} are best-effort: a failure on those upstream
 * calls degrades them to empty/{@code null} rather than failing the whole request, because current
 * conditions alone still make a useful page.
 */
public record WeatherBundleDto(
        PlaceDto place,
        CurrentDto current,
        List<HourDto> hourly,
        List<DayDto> daily,
        AirQualityDto air
) {

    /**
     * @param timezoneOffsetSeconds shift from UTC at the observed location — the client needs it to
     *                              label hours and sun times in the *place's* time, not the reader's
     */
    public record PlaceDto(
            String name,
            String country,
            double lat,
            double lon,
            int timezoneOffsetSeconds
    ) {}

    /** OpenWeather's condition triple, passed through so the client picks its own artwork. */
    public record ConditionDto(int id, String main, String description, String icon) {}

    public record CurrentDto(
            double tempC,
            double feelsLikeC,
            double minC,
            double maxC,
            int humidity,
            int pressure,
            double windSpeedMs,
            int windDeg,
            Double windGustMs,
            Integer visibilityM,
            int cloudsPct,
            long observedAtEpoch,
            Long sunriseEpoch,
            Long sunsetEpoch,
            ConditionDto condition
    ) {}

    /** One 3-hour forecast slot. {@code popPct} is OpenWeather's probability of precipitation. */
    public record HourDto(
            long atEpoch,
            double tempC,
            double feelsLikeC,
            int popPct,
            double windSpeedMs,
            int humidity,
            ConditionDto condition
    ) {}

    /**
     * One local calendar day, folded from that day's 3-hour slots.
     *
     * @param condition the slot nearest local midday — the icon a reader expects for "Thursday" is
     *                  the daytime one, not whatever happened to fall at 03:00
     */
    public record DayDto(
            LocalDate date,
            double minC,
            double maxC,
            int popPct,
            double windSpeedMs,
            int humidity,
            ConditionDto condition
    ) {}

    /**
     * @param aqi        OpenWeather's 1–5 index (1 = best)
     * @param label      the human name for that index
     * @param components pollutant concentrations in µg/m³, keyed by OpenWeather's own names
     */
    public record AirQualityDto(int aqi, String label, Map<String, Double> components) {}
}
