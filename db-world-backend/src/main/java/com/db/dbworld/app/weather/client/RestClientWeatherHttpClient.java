package com.db.dbworld.app.weather.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

/** {@link RestClient}-backed {@link WeatherHttpClient}. */
@Slf4j
@Component
public class RestClientWeatherHttpClient implements WeatherHttpClient {

    private final RestClient restClient = RestClient.create();

    @Override
    public JsonNode getJson(String url) {
        try {
            ResponseEntity<JsonNode> response = restClient.get().uri(url).retrieve().toEntity(JsonNode.class);
            JsonNode body = response.getBody();
            if (body == null) {
                throw new WeatherUpstreamException("Empty weather response", false);
            }
            return body;
        } catch (HttpClientErrorException.NotFound e) {
            throw new WeatherUpstreamException("Not found", true, e);
        } catch (HttpClientErrorException e) {
            log.warn("OpenWeather upstream error {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new WeatherUpstreamException("Weather upstream error " + e.getStatusCode().value(), false, e);
        } catch (WeatherUpstreamException e) {
            throw e;
        } catch (Exception e) {
            log.warn("OpenWeather call failed: {}", e.toString());
            throw new WeatherUpstreamException("Weather upstream call failed", false, e);
        }
    }
}
