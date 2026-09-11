package com.db.dbworld.app.weather.client;

/**
 * An OpenWeather call failed. {@link #notFound()} distinguishes "that place does not exist"
 * (a 404, which the caller turns into a 404 for the user) from every other upstream problem
 * (which becomes a 502) — the two mean very different things to someone typing a city name.
 */
public class WeatherUpstreamException extends RuntimeException {

    private final boolean notFound;

    public WeatherUpstreamException(String message, boolean notFound, Throwable cause) {
        super(message, cause);
        this.notFound = notFound;
    }

    public WeatherUpstreamException(String message, boolean notFound) {
        this(message, notFound, null);
    }

    public boolean notFound() {
        return notFound;
    }
}
