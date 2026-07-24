package com.db.dbworld.app.ipo.source.support;

import com.db.dbworld.app.ipo.source.SourceFetchException;

import java.util.Map;

/**
 * Thin HTTP seam shared by every {@code IpoSource} adapter. The single implementation
 * ({@link IpoHttpClientImpl}) reuses the codebase's existing WebClient + transient-network-retry
 * pattern (see {@code TmdbClient} / {@code TmdbWebClientConfig} in {@code cinema.tmdb}) rather
 * than introducing a new HTTP library.
 *
 * <p>Kept as an interface — separate from the concrete WebClient wiring — purely so adapter
 * unit tests can mock the HTTP boundary directly instead of stubbing WebClient's reactive
 * fluent chain.
 */
public interface IpoHttpClient {

    /**
     * Performs a GET request.
     *
     * @param url     absolute URL to call
     * @param headers request headers (may be empty, never null)
     * @return the response body/headers, only ever returned for a 2xx status
     * @throws SourceFetchException on any non-2xx response or network failure. Transient
     *                              connection resets are already retried internally before
     *                              this is thrown.
     */
    IpoHttpResponse get(String url, Map<String, String> headers);
}
