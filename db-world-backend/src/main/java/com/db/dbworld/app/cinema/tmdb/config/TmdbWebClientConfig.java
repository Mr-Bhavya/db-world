package com.db.dbworld.app.cinema.tmdb.config;

import io.netty.channel.ChannelOption;
import lombok.extern.log4j.Log4j2;
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;

@Log4j2
@Configuration
public class TmdbWebClientConfig {

    @Bean
    public WebClient tmdbWebClient(TmdbProperties properties) {

        log.info("Initializing TMDB WebClient (baseUrl={})", properties.getBaseUrl());

        ConnectionProvider provider =
                ConnectionProvider.builder("tmdb-connection-pool")
                        .maxConnections(50)
                        .pendingAcquireTimeout(Duration.ofSeconds(30))
                        .pendingAcquireMaxCount(500)
                        .maxIdleTime(Duration.ofSeconds(30))
                        .build();

        HttpClient httpClient =
                HttpClient.create(provider)
                        .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000)
                        .responseTimeout(Duration.ofSeconds(15))
                        .doOnConnected(conn ->
                                log.debug("TMDB connection established: {}", conn.channel().id())
                        );

        ExchangeStrategies strategies =
                ExchangeStrategies.builder()
                        .codecs(configurer ->
                                configurer.defaultCodecs()
                                        .maxInMemorySize(10 * 1024 * 1024) // 10MB buffer
                        )
                        .build();

        return WebClient.builder()
                .baseUrl(properties.getBaseUrl())
                .defaultHeader(HttpHeaders.AUTHORIZATION,
                        "Bearer " + properties.getBearerToken())
                .defaultHeader(HttpHeaders.ACCEPT, "application/json")
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .exchangeStrategies(strategies)

                .filter((request, next) -> {

                    long start = System.currentTimeMillis();

                    log.debug("TMDB Request: {} {}", request.method(), request.url());

                    return next.exchange(request)

                            .doOnSuccess(response -> {

                                long time = System.currentTimeMillis() - start;

                                log.info(
                                        "TMDB {} {} -> {} ({} ms)",
                                        request.method(),
                                        request.url(),
                                        response.statusCode().value(),
                                        time
                                );
                            })

                            .doOnError(error -> {

                                long time = System.currentTimeMillis() - start;

                                log.error(
                                        "TMDB Request Failed: {} {} ({} ms) - {}",
                                        request.method(),
                                        request.url(),
                                        time,
                                        error.getMessage(),
                                        error
                                );
                            });
                })
                .build();
    }
}