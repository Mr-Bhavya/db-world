package com.db.dbworld.app.weather.dto;

/**
 * One geocoding hit for the city search box.
 *
 * <p>{@code state} is what disambiguates the six Springfields; it is absent for most of the world,
 * so it is nullable rather than blank-filled.
 */
public record GeoPlaceDto(
        String name,
        String state,
        String country,
        double lat,
        double lon
) {}
