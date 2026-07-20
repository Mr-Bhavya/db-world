package com.db.dbworld.infrastructure.logging.mdc;

/**
 * Canonical MDC (Log4j2 {@code ThreadContext}) keys.
 *
 * <p>Keep this in sync with the {@code %X{...}} placeholders in
 * {@code log4j2-spring.xml}. Adding a new MDC slot here without also updating
 * the pattern means it won't appear in logs.
 */
public final class MdcKeys {

    private MdcKeys() {}

    /** Per-request UUID (one per HTTP request). */
    public static final String REQUEST_ID = "requestId";

    /** Per-request UUID propagated across async boundaries. */
    public static final String TRACE_ID   = "traceId";

    /** Authenticated user email or "anonymous". */
    public static final String USER       = "user";

    public static final String METHOD     = "method";
    public static final String URI        = "uri";
    public static final String STATUS     = "status";

    /** Duration in milliseconds (string-valued). */
    public static final String DURATION   = "duration";

    /**
     * Request/response body fingerprint. Format: {@code req=<hex>;res=<hex>}.
     * Empty if body unavailable (GET without body, streaming response, etc.).
     */
    public static final String MD5        = "md5";

    /** Marker for "this is a request-lifecycle log line" (vs application code). */
    public static final String IS_REQUEST = "isRequest";

    /** Original client IP after X-Forwarded-For unwrapping. */
    public static final String CLIENT_IP  = "clientIp";

    /** Query string (already URL-encoded). */
    public static final String QUERY      = "query";
}
