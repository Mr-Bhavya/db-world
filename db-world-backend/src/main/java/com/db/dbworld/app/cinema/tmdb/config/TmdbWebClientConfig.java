package com.db.dbworld.app.cinema.tmdb.config;

import io.netty.channel.ChannelOption;
import lombok.extern.log4j.Log4j2;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;
import reactor.util.retry.Retry;
import reactor.util.retry.RetryBackoffSpec;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.http.codec.json.JacksonJsonDecoder;
import org.springframework.http.codec.json.JacksonJsonEncoder;
import org.springframework.web.reactive.function.client.ExchangeFilterFunction;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.Locale;

/**
 * WebClient configuration for the TMDB API.
 *
 * <p>Responsibilities:
 * <ul>
 *     <li>Builds a tuned, pooled, non-blocking HTTP client.</li>
 *     <li>Adds JSON codecs relaxed for TMDB's frequent null-on-primitive payloads.</li>
 *     <li>Adds resilient retry filters for HTTP 429 and transient network failures
 *         (e.g. {@code Connection reset}, stale pooled sockets).</li>
 * </ul>
 */
@Log4j2
@Configuration
public class TmdbWebClientConfig {

    private static final int MAX_CONNECTIONS = 50;
    private static final int PENDING_ACQUIRE_MAX = 500;
    private static final int MAX_IN_MEMORY_BYTES = 10 * 1024 * 1024; // 10 MB
    private static final int CONNECT_TIMEOUT_MS = 5_000;

    private static final Duration PENDING_ACQUIRE_TIMEOUT = Duration.ofSeconds(30);
    private static final Duration MAX_IDLE_TIME = Duration.ofSeconds(5);
    private static final Duration MAX_LIFE_TIME = Duration.ofMinutes(2);
    private static final Duration EVICT_INTERVAL = Duration.ofSeconds(5);
    private static final Duration RESPONSE_TIMEOUT = Duration.ofSeconds(15);

    private static final int RL_MAX_ATTEMPTS = 5;
    private static final Duration RL_INITIAL_BACKOFF = Duration.ofSeconds(1);
    private static final Duration RL_MAX_BACKOFF = Duration.ofSeconds(30);

    private static final int NET_MAX_ATTEMPTS = 3;
    private static final Duration NET_INITIAL_BACKOFF = Duration.ofMillis(500);
    private static final Duration NET_MAX_BACKOFF = Duration.ofSeconds(5);

    private static final double JITTER = 0.3d;

    /* =========================================================
       BEAN
       ========================================================= */

    @Bean
    @Lazy
    public WebClient tmdbWebClient(TmdbProperties properties) {

        log.info("Initializing TMDB WebClient (baseUrl={})", properties.getBaseUrl());

        var provider = buildConnectionProvider();
        var httpClient = buildHttpClient(provider);
        var strategies = buildExchangeStrategies();

        var client = WebClient.builder()
                .baseUrl(properties.getBaseUrl())
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.getBearerToken())
                .defaultHeader(HttpHeaders.ACCEPT, "application/json")
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .exchangeStrategies(strategies)
                .filter(retryOn429())
                .filter(observabilityFilter())
                .build();

        log.info("TMDB WebClient ready (maxConnections={}, responseTimeout={}s, maxIdle={}s, evictEvery={}s)",
                MAX_CONNECTIONS,
                RESPONSE_TIMEOUT.toSeconds(),
                MAX_IDLE_TIME.toSeconds(),
                EVICT_INTERVAL.toSeconds());

        return client;
    }

    /* =========================================================
       INFRASTRUCTURE BUILDERS
       ========================================================= */

    private static ConnectionProvider buildConnectionProvider() {
        return ConnectionProvider.builder("tmdb-connection-pool")
                .maxConnections(MAX_CONNECTIONS)
                .pendingAcquireTimeout(PENDING_ACQUIRE_TIMEOUT)
                .pendingAcquireMaxCount(PENDING_ACQUIRE_MAX)
                .maxIdleTime(MAX_IDLE_TIME)
                .maxLifeTime(MAX_LIFE_TIME)
                .evictInBackground(EVICT_INTERVAL)
                .lifo()
                .build();
    }

    private static HttpClient buildHttpClient(ConnectionProvider provider) {
        return HttpClient.create(provider)
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, CONNECT_TIMEOUT_MS)
                .option(ChannelOption.SO_KEEPALIVE, true)
                .responseTimeout(RESPONSE_TIMEOUT)
                .doOnConnected(conn ->
                        log.debug("TMDB connection established: id={}", conn.channel().id()));
    }

    /**
     * TMDB often returns {@code null} for primitive numeric/boolean fields
     * (runtime, vote_count, adult, ...). Without relaxing the decoder, a single
     * null primitive anywhere in the payload fails the entire decode.
     * Scope is intentionally limited to this WebClient.
     */
    private static ExchangeStrategies buildExchangeStrategies() {
        var mapper = JsonMapper.builder()
                .disable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
                .build();

        return ExchangeStrategies.builder()
                .codecs(cfg -> {
                    cfg.defaultCodecs().maxInMemorySize(MAX_IN_MEMORY_BYTES);
                    cfg.defaultCodecs().jacksonJsonDecoder(new JacksonJsonDecoder(mapper));
                    cfg.defaultCodecs().jacksonJsonEncoder(new JacksonJsonEncoder(mapper));
                })
                .build();
    }

    /* =========================================================
       FILTERS
       ========================================================= */

    /** Logs each request with method, URL and total duration. */
    private static ExchangeFilterFunction observabilityFilter() {
        return (request, next) -> {
            final long start = System.currentTimeMillis();
            log.debug("TMDB → {} {}", request.method(), request.url());

            return next.exchange(request)
                    .doOnSuccess(response -> {
                        if (response != null) {
                            var sc = response.statusCode();
                            log.info("TMDB {} {} → {} ({} ms)",
                                    request.method(),
                                    request.url(),
                                    sc.value(),
                                    System.currentTimeMillis() - start);
                        }
                    })
                    .doOnError(error -> log.warn(
                            // One-line WARN per attempt only. Transient resets are retried by
                            // TmdbClient (which re-runs this filter), so a full stack trace here
                            // would fire on every recoverable blip. The final, unrecoverable
                            // failure is logged with its stack trace by the sync orchestrator.
                            "TMDB FAILED {} {} ({} ms) - rootCause={}",
                            request.method(),
                            request.url(),
                            System.currentTimeMillis() - start,
                            rootCause(error)
                    ));
        };
    }

    /**
     * Retries on HTTP 429 (Too Many Requests).
     *
     * <p>Uses exponential backoff + jitter, but when TMDB provides Retry-After,
     * that value is honored as a minimum delay before the next retry attempt.
     */
    private static ExchangeFilterFunction retryOn429() {
        return (request, next) -> next.exchange(request)
                .flatMap(response -> {
                    if (response.statusCode().value() == HttpStatus.TOO_MANY_REQUESTS.value()) {
                        long delaySec = parseRetryAfter(response.headers().header(HttpHeaders.RETRY_AFTER));
                        log.warn("TMDB 429 received: {} {} (Retry-After={}s)",
                                request.method(), request.url(), delaySec);
                        return response.releaseBody()
                                .then(Mono.error(new TmdbRateLimitedException(delaySec)));
                    }
                    return Mono.just(response);
                })
                .retryWhen(build429RetrySpec(request.method().name(), request.url()));
    }

    /**
     * Retry spec for transient connection problems such as {@code Connection reset},
     * stale pooled sockets, premature closes and read timeouts.
     *
     * <p><b>Why this is not a {@link ExchangeFilterFunction}:</b> a WebClient filter only
     * wraps {@code next.exchange(request)}, which completes the moment the response
     * <i>headers</i> arrive. The response <i>body</i> is streamed afterwards, downstream
     * of the filter. A reset while reading a large TMDB body (e.g. the full
     * {@code append_to_response=images,videos,credits} payload) therefore bypasses any
     * filter-level retry and surfaces as a hard failure. {@link TmdbClient} applies this
     * spec around the whole call — connection acquisition, header receipt <i>and</i> body
     * read — so a reset at any stage is retried by re-issuing the request.
     *
     * <p>Safe because every TMDB call in {@link TmdbClient} is an idempotent GET.
     */
    public static Retry transientNetworkRetry(String description) {
        return Retry.backoff(NET_MAX_ATTEMPTS, NET_INITIAL_BACKOFF)
                .maxBackoff(NET_MAX_BACKOFF)
                .jitter(JITTER)
                .filter(TmdbWebClientConfig::isTransientNetworkError)
                .doBeforeRetry(rs -> log.warn(
                        "TMDB network retry attempt {}/{} for {} (cause={})",
                        rs.totalRetries() + 1,
                        NET_MAX_ATTEMPTS,
                        description,
                        rootCause(rs.failure())))
                .onRetryExhaustedThrow((spec, signal) -> {
                    log.error("TMDB network retries exhausted for {} - {}",
                            description,
                            rootCause(signal.failure()));
                    return signal.failure();
                });
    }

    /* =========================================================
       RETRY SPECS
       ========================================================= */

    private static Retry build429RetrySpec(String method, URI url) {
        RetryBackoffSpec fallback = Retry.backoff(RL_MAX_ATTEMPTS, RL_INITIAL_BACKOFF)
                .maxBackoff(RL_MAX_BACKOFF)
                .jitter(JITTER)
                .filter(TmdbWebClientConfig::isRateLimited);

        return Retry.from(companion ->
                companion.concatMap(rs -> next429RetryDelay(rs, method, url)
                                .flatMap(delay -> Mono.delay(delay).then())
                        )
                        .onErrorStop()
        );
    }

    private static Mono<Duration> next429RetryDelay(Retry.RetrySignal rs, String method, URI url) {
        Throwable failure = rs.failure();

        if (!isRateLimited(failure)) {
            return Mono.error(failure);
        }

        long attempt = rs.totalRetries() + 1;
        if (attempt > RL_MAX_ATTEMPTS) {
            log.error("TMDB 429 retries exhausted for {} {} - {}",
                    method, url, rootCause(failure));
            return Mono.error(failure);
        }

        Duration exponential = calculateExponentialBackoff(attempt, RL_INITIAL_BACKOFF, RL_MAX_BACKOFF);
        Duration retryAfter = retryAfterDelay(failure);
        Duration finalDelay = retryAfter.compareTo(exponential) > 0 ? retryAfter : exponential;

        log.warn("TMDB 429 retry attempt {}/{} for {} {} after {} ms (cause={})",
                attempt,
                RL_MAX_ATTEMPTS,
                method,
                url,
                finalDelay.toMillis(),
                rootCause(failure));

        return Mono.just(applyJitter(finalDelay, JITTER));
    }

    /* =========================================================
       PREDICATES (Java 25 pattern matching)
       ========================================================= */

    private static boolean isRateLimited(Throwable t) {
        return switch (t) {
            case TmdbRateLimitedException ignored -> true;
            case WebClientResponseException w -> {
                var sc = w.getStatusCode();
                yield sc.value() == HttpStatus.TOO_MANY_REQUESTS.value();
            }
            default -> false;
        };
    }

    private static boolean isTransientNetworkError(Throwable t) {
        Throwable cause = t;
        while (cause != null) {
            if (cause instanceof WebClientRequestException
                    || cause instanceof IOException
                    || cause instanceof java.util.concurrent.TimeoutException) {
                return true;
            }

            String message = cause.getMessage();
            if (message != null) {
                String lower = message.toLowerCase(Locale.ROOT);
                if (lower.contains("connection reset")
                        || lower.contains("broken pipe")
                        || lower.contains("premature close")
                        || lower.contains("connection prematurely closed")
                        || lower.contains("connection closed")) {
                    return true;
                }
            }

            cause = cause.getCause();
        }
        return false;
    }

    /* =========================================================
       HELPERS
       ========================================================= */

    private static long parseRetryAfter(List<String> values) {
        if (values == null || values.isEmpty()) {
            return 0L;
        }
        try {
            return Long.parseLong(values.getFirst().trim());
        } catch (NumberFormatException ignored) {
            return 0L;
        }
    }

    private static Duration retryAfterDelay(Throwable t) {
        if (t instanceof TmdbRateLimitedException ex) {
            return ex.retryAfter();
        }
        return Duration.ZERO;
    }

    private static Duration calculateExponentialBackoff(long attempt,
                                                        Duration initial,
                                                        Duration max) {
        long multiplier = 1L << Math.max(0, attempt - 1);
        long millis = initial.toMillis() * multiplier;
        return Duration.ofMillis(Math.min(millis, max.toMillis()));
    }

    private static Duration applyJitter(Duration base, double jitterFactor) {
        if (base.isZero() || jitterFactor <= 0d) {
            return base;
        }

        double min = 1d - jitterFactor;
        double max = 1d + jitterFactor;
        double randomized = min + (Math.random() * (max - min));

        long jitteredMillis = Math.max(1L, Math.round(base.toMillis() * randomized));
        return Duration.ofMillis(jitteredMillis);
    }

    private static String rootCause(Throwable t) {
        Throwable cause = t;
        while (cause.getCause() != null) {
            cause = cause.getCause();
        }
        String message = cause.getMessage();
        return cause.getClass().getSimpleName() + (message == null || message.isBlank() ? "" : ": " + message);
    }

    /** Internal marker so the retry filter can identify 429s consumed by the response handler. */
    private static final class TmdbRateLimitedException extends RuntimeException {
        private final Duration retryAfter;

        TmdbRateLimitedException(long retryAfterSec) {
            super("TMDB rate limited (Retry-After=" + retryAfterSec + "s)");
            this.retryAfter = retryAfterSec > 0
                    ? Duration.ofSeconds(retryAfterSec)
                    : Duration.ZERO;
        }

        Duration retryAfter() {
            return retryAfter;
        }
    }
}