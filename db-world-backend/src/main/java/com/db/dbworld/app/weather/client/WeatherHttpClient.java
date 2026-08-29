package com.db.dbworld.app.weather.client;

import tools.jackson.databind.JsonNode;

/**
 * Thin HTTP seam in front of OpenWeather.
 *
 * <p>Kept as an interface — separate from the concrete {@code RestClient} wiring — purely so
 * {@code WeatherService} can be unit-tested against the boundary instead of stubbing a fluent
 * client chain. Same pattern as {@code IpoHttpClient} in {@code app.ipo.source.support}.
 */
public interface WeatherHttpClient {

    /**
     * Performs a GET and parses the body as JSON.
     *
     * @param url absolute URL, query string included
     * @return the parsed body, never {@code null}
     * @throws WeatherUpstreamException on a non-2xx response, an empty body or a network failure
     */
    JsonNode getJson(String url);
}
