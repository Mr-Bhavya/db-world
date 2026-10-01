package com.db.dbworld.app.ipo.source;

/**
 * An upstream call failed: non-2xx response, network error, anti-bot block, unparseable payload.
 *
 * <p>Thrown out of {@link IpoSource#fetchAll()} when the source as a whole could not be read, so
 * the poll can record and count the failure. Per-IPO enrichment failures (a detail page) stay
 * inside the source. {@link #status()} is what lands on the source's health row.
 */
public class SourceFetchException extends RuntimeException {

    public static final String FAILED = "FAILED";
    public static final String RATE_LIMITED = "RATE_LIMITED";
    /** Not a failure: the source has no credentials, so it was skipped. */
    public static final String NOT_CONFIGURED = "NOT_CONFIGURED";

    private final String status;

    public SourceFetchException(String message) {
        this(FAILED, message, null);
    }

    public SourceFetchException(String message, Throwable cause) {
        this(FAILED, message, cause);
    }

    public SourceFetchException(String status, String message, Throwable cause) {
        super(message, cause);
        this.status = status;
    }

    public static SourceFetchException notConfigured(String message) {
        return new SourceFetchException(NOT_CONFIGURED, message, null);
    }

    public String status() {
        return status;
    }

    public boolean notConfigured() {
        return NOT_CONFIGURED.equals(status);
    }
}
