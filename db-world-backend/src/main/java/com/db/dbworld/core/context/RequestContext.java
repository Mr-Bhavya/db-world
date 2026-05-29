package com.db.dbworld.core.context;

import java.util.UUID;

/**
 * Per-request context (traceId / requestId).
 *
 * <p>Seeded by {@code MdcContextFilter} at the top of the servlet filter chain
 * and cleared in its {@code finally} block. Use the lazy {@code get*()} methods
 * inside filters that may run before seeding (defensive); inside business code
 * just rely on the seed having already happened.
 *
 * <p>For async work, the parent thread's MDC must be propagated by
 * {@code MdcTaskDecorator} — do NOT call {@link #init()} on the worker thread.
 */
public final class RequestContext {

    private static final ThreadLocal<String> REQUEST_ID = new ThreadLocal<>();
    private static final ThreadLocal<String> TRACE_ID   = new ThreadLocal<>();

    private RequestContext() {}

    /** Seeds new IDs. Safe to call multiple times on the same thread (overwrites). */
    public static void init() {
        REQUEST_ID.set(UUID.randomUUID().toString());
        TRACE_ID.set(UUID.randomUUID().toString());
    }

    /**
     * Returns the request ID, generating one lazily if absent. Defensive against
     * code paths that read the ID before the seeding filter runs (e.g., very
     * early exceptions in another filter).
     */
    public static String getRequestId() {
        String id = REQUEST_ID.get();
        if (id == null) {
            id = UUID.randomUUID().toString();
            REQUEST_ID.set(id);
        }
        return id;
    }

    /** Returns the trace ID, generating one lazily if absent. See {@link #getRequestId()}. */
    public static String getTraceId() {
        String id = TRACE_ID.get();
        if (id == null) {
            id = UUID.randomUUID().toString();
            TRACE_ID.set(id);
        }
        return id;
    }

    /** Sets an explicit trace ID (e.g., propagated from an upstream service). */
    public static void setTraceId(String id) {
        TRACE_ID.set(id);
    }

    public static void clear() {
        REQUEST_ID.remove();
        TRACE_ID.remove();
    }
}
