package com.db.dbworld.app.ipo.source.support;

import io.netty.channel.ChannelOption;
import lombok.extern.log4j.Log4j2;
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;
import reactor.util.retry.Retry;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;

import java.io.IOException;
import java.time.Duration;
import java.util.Locale;

/**
 * WebClient configuration for the IPO Tracker's source adapters (IPO Guru, NSE, Chittorgarh).
 *
 * <p>Mirrors {@code com.db.dbworld.app.cinema.tmdb.config.TmdbWebClientConfig}'s approach —
 * a pooled, timeout-tuned {@link HttpClient} plus a {@link Retry} spec for transient network
 * failures (connection reset, stale pooled sockets, premature close) applied around the WHOLE
 * request including the body read. Kept as a separate, module-local bean (rather than reusing
 * {@code tmdbWebClient}) because it has no fixed base URL or bearer token — each source calls a
 * different host, and the IPO Guru base URL is a runtime-editable {@code SettingsService} value.
 *
 * <p>Unlike TMDB, IPO Guru's documented contract treats HTTP 429 as a plain failure (log +
 * return {@code []}, no retry-with-backoff — see {@code IpoGuruSource}), so no 429-specific
 * retry filter is needed here.
 */
@Log4j2
@Configuration
public class IpoWebClientConfig {

    private static final int MAX_CONNECTIONS = 20;
    private static final int PENDING_ACQUIRE_MAX = 100;
    private static final int CONNECT_TIMEOUT_MS = 5_000;

    private static final Duration PENDING_ACQUIRE_TIMEOUT = Duration.ofSeconds(30);
    private static final Duration MAX_IDLE_TIME = Duration.ofSeconds(10);
    private static final Duration RESPONSE_TIMEOUT = Duration.ofSeconds(15);

    private static final int NET_MAX_ATTEMPTS = 3;
    private static final Duration NET_INITIAL_BACKOFF = Duration.ofMillis(500);
    private static final Duration NET_MAX_BACKOFF = Duration.ofSeconds(5);
    private static final double JITTER = 0.3d;

    @Bean
    public WebClient ipoWebClient() {
        var provider = ConnectionProvider.builder("ipo-connection-pool")
                .maxConnections(MAX_CONNECTIONS)
                .pendingAcquireTimeout(PENDING_ACQUIRE_TIMEOUT)
                .pendingAcquireMaxCount(PENDING_ACQUIRE_MAX)
                .maxIdleTime(MAX_IDLE_TIME)
                .build();

        var httpClient = HttpClient.create(provider)
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, CONNECT_TIMEOUT_MS)
                .responseTimeout(RESPONSE_TIMEOUT);

        log.info("IPO WebClient ready (maxConnections={}, responseTimeout={}s)",
                MAX_CONNECTIONS, RESPONSE_TIMEOUT.toSeconds());

        return WebClient.builder()
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }

    /**
     * Retry spec for transient connection problems (connection reset, stale pooled sockets,
     * premature close, read timeouts). Applied by {@link IpoHttpClientImpl} around the whole
     * request/response exchange — see {@code TmdbWebClientConfig.transientNetworkRetry} for why
     * this must wrap the call site rather than live in a WebClient filter.
     */
    public static Retry transientNetworkRetry(String description) {
        return Retry.backoff(NET_MAX_ATTEMPTS, NET_INITIAL_BACKOFF)
                .maxBackoff(NET_MAX_BACKOFF)
                .jitter(JITTER)
                .filter(IpoWebClientConfig::isTransientNetworkError)
                .doBeforeRetry(rs -> log.warn(
                        "IPO network retry attempt {}/{} for {} (cause={})",
                        rs.totalRetries() + 1,
                        NET_MAX_ATTEMPTS,
                        description,
                        rootCause(rs.failure())))
                .onRetryExhaustedThrow((spec, signal) -> {
                    log.error("IPO network retries exhausted for {} - {}", description, rootCause(signal.failure()));
                    return signal.failure();
                });
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

    private static String rootCause(Throwable t) {
        Throwable cause = t;
        while (cause.getCause() != null) {
            cause = cause.getCause();
        }
        String message = cause.getMessage();
        return cause.getClass().getSimpleName() + (message == null || message.isBlank() ? "" : ": " + message);
    }
}
