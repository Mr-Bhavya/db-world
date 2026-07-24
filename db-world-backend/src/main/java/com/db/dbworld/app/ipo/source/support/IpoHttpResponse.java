package com.db.dbworld.app.ipo.source.support;

import org.springframework.http.HttpHeaders;

import java.util.List;

/**
 * A successful (2xx) HTTP response as seen by {@link IpoHttpClient}. Non-2xx responses and
 * network failures never produce one of these — they surface as {@link com.db.dbworld.app.ipo.source.SourceFetchException}.
 */
public record IpoHttpResponse(String body, HttpHeaders headers) {

    /** Convenience accessor mirroring {@link HttpHeaders#get(Object)}, null-safe on missing headers. */
    public List<String> header(String name) {
        if (headers == null) {
            return List.of();
        }
        List<String> values = headers.get(name);
        return values == null ? List.of() : values;
    }
}
