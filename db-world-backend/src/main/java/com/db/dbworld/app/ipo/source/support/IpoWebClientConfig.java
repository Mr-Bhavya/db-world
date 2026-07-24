package com.db.dbworld.app.ipo.source.support;

import io.netty.channel.ChannelOption;
import lombok.extern.log4j.Log4j2;
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;

/**
 * WebClient configuration for the IPO Tracker's source adapters (IPO Guru, NSE, Chittorgarh).
 *
 * <p>Mirrors {@code com.db.dbworld.app.cinema.tmdb.config.TmdbWebClientConfig}'s approach —
 * a pooled, timeout-tuned {@link HttpClient}. Kept as a separate, module-local bean (rather than
 * reusing {@code tmdbWebClient}) because it has no fixed base URL or bearer token — each source
 * calls a different host, and the IPO Guru base URL is a runtime-editable {@code SettingsService}
 * value.
 *
 * <p>Unlike TMDB, IPO Guru's documented contract treats HTTP 429 as a plain failure (log +
 * return {@code []}, no retry-with-backoff — see {@code IpoGuruSource}), so no 429-specific
 * retry filter is needed here. The transient-network retry spec itself is shared with TMDB —
 * see {@code TmdbWebClientConfig.transientNetworkRetry}, invoked directly by
 * {@link IpoHttpClientImpl} — rather than duplicated here.
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
}
