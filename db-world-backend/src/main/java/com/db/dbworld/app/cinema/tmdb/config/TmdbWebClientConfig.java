package com.db.dbworld.app.cinema.tmdb.config;

import io.netty.channel.ChannelOption;
import lombok.extern.log4j.Log4j2;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;
import reactor.util.retry.Retry;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.ExchangeFilterFunction;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;

@Log4j2
@Configuration
public class TmdbWebClientConfig {

    @Bean
    @Lazy
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

                .filter(retryOn429())

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

    /**
     * Retries on TMDB 429 with backoff. Honors Retry-After when present,
     * otherwise falls back to exponential jitter starting at 1s.
     * Limits to 5 attempts so a sustained outage doesn't loop forever.
     */
    private static ExchangeFilterFunction retryOn429() {
        return (request, next) -> next.exchange(request)
                .flatMap(response -> {
                    if (response.statusCode() == HttpStatus.TOO_MANY_REQUESTS) {
                        long delaySec = parseRetryAfter(
                                response.headers().header(HttpHeaders.RETRY_AFTER));
                        return response.releaseBody().then(Mono.error(
                                new TmdbRateLimitedException(delaySec)));
                    }
                    return Mono.just(response);
                })
                .retryWhen(Retry.backoff(5, Duration.ofSeconds(1))
                        .maxBackoff(Duration.ofSeconds(30))
                        .jitter(0.3)
                        .filter(t -> t instanceof TmdbRateLimitedException
                                || (t instanceof WebClientResponseException w
                                    && w.getStatusCode() == HttpStatus.TOO_MANY_REQUESTS))
                        .doBeforeRetry(rs -> log.warn(
                                "TMDB 429 — retry attempt {} after backoff ({}): {} {}",
                                rs.totalRetries() + 1,
                                rs.failure().getMessage(),
                                request.method(),
                                request.url()))
                        .onRetryExhaustedThrow((spec, signal) -> signal.failure()));
    }

    private static long parseRetryAfter(java.util.List<String> values) {
        if (values == null || values.isEmpty()) return 0L;
        try {
            return Long.parseLong(values.get(0).trim());
        } catch (NumberFormatException ignored) {
            return 0L;
        }
    }

    /** Internal signal so the retry filter can identify 429s consumed by the response handler. */
    private static final class TmdbRateLimitedException extends RuntimeException {
        TmdbRateLimitedException(long retryAfterSec) {
            super("TMDB rate limited (Retry-After=" + retryAfterSec + "s)");
        }
    }
}