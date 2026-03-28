package com.db.dbworld.context;

import java.util.UUID;

public final class RequestContext {

    private static final ThreadLocal<String> REQUEST_ID = new ThreadLocal<>();
    private static final ThreadLocal<String> TRACE_ID = new ThreadLocal<>();

    private RequestContext() {}

    public static void init() {
        REQUEST_ID.set(UUID.randomUUID().toString());
        TRACE_ID.set(UUID.randomUUID().toString());
    }

    public static String getRequestId() {
        return REQUEST_ID.get();
    }

    public static String getTraceId() {
        return TRACE_ID.get();
    }

    public static void clear() {
        REQUEST_ID.remove();
        TRACE_ID.remove();
    }
}
