package com.db.dbworld.app.ipo.source.support;

import com.db.dbworld.app.cinema.tmdb.config.TmdbWebClientConfig;
import com.db.dbworld.app.ipo.source.SourceFetchException;
import lombok.extern.log4j.Log4j2;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.net.URI;
import java.time.Duration;
import java.util.Map;

/**
 * Reactive {@link WebClient}-backed {@link IpoHttpClient}. Blocks the reactive call at this
 * single boundary because every {@code IpoSource.fetchAll()} is a synchronous call driven by a
 * scheduled job, not a request thread — the same pattern the codebase already uses elsewhere to
 * consume TMDB's reactive client from synchronous orchestration code (see
 * {@code TmdbSyncOrchestratorService}).
 */
@Log4j2
@Component
public class IpoHttpClientImpl implements IpoHttpClient {

    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(20);

    private final WebClient webClient;

    public IpoHttpClientImpl(@Qualifier("ipoWebClient") WebClient webClient) {
        this.webClient = webClient;
    }

    @Override
    public IpoHttpResponse get(String url, Map<String, String> headers) {
        try {
            ResponseEntity<String> entity = webClient.get()
                    .uri(URI.create(url))
                    .headers(h -> {
                        if (headers != null) {
                            headers.forEach(h::add);
                        }
                    })
                    .retrieve()
                    .toEntity(String.class)
                    // Retries transient network failures around the FULL request — including the
                    // body read. Reuses TmdbWebClientConfig's spec (rather than duplicating it)
                    // since the retry semantics are identical — see its javadoc for why this must
                    // wrap the call site rather than live in a WebClient filter.
                    .retryWhen(TmdbWebClientConfig.transientNetworkRetry("IPO " + url))
                    .block(REQUEST_TIMEOUT);

            if (entity == null) {
                throw new SourceFetchException("Null response for GET " + url);
            }
            return new IpoHttpResponse(entity.getBody(), entity.getHeaders());
        } catch (SourceFetchException e) {
            throw e;
        } catch (WebClientResponseException e) {
            log.warn("IPO HTTP failure; status={} url={} message={}", e.getStatusCode().value(), url, e.getMessage());
            throw new SourceFetchException("HTTP " + e.getStatusCode().value() + " for GET " + url, e);
        } catch (Exception e) {
            log.warn("IPO HTTP failure; url={} message={}", url, e.toString());
            throw new SourceFetchException("GET " + url + " failed: " + e.getMessage(), e);
        }
    }
}
