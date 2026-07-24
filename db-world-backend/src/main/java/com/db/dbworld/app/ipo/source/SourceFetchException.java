package com.db.dbworld.app.ipo.source;

/**
 * Internal signal that a single upstream call failed (non-2xx response, network error,
 * anti-bot block, unparseable payload, ...). Always caught and swallowed to {@code []} at
 * the {@link IpoSource#fetchAll()} boundary — never propagated to callers of a source.
 */
public class SourceFetchException extends RuntimeException {

    public SourceFetchException(String message) {
        super(message);
    }

    public SourceFetchException(String message, Throwable cause) {
        super(message, cause);
    }
}
