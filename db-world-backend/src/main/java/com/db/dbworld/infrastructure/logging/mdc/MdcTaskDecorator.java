package com.db.dbworld.infrastructure.logging.mdc;

import org.apache.logging.log4j.ThreadContext;
import org.springframework.core.task.TaskDecorator;
import org.springframework.lang.NonNull;

import java.util.Map;

/**
 * Copies the submitter thread's MDC into the worker thread before the task
 * runs, restoring the worker's prior MDC afterwards.
 *
 * <p>Without this, every {@code @Async} method, {@code CompletableFuture}
 * stage, and scheduled task starts with an empty MDC — so {@code traceId},
 * {@code user}, etc. silently disappear from any log lines emitted in the
 * background.
 *
 * <p>Wired into Spring's default async executor via {@code MdcAsyncConfig}.
 */
public class MdcTaskDecorator implements TaskDecorator {

    @Override
    @NonNull
    public Runnable decorate(@NonNull Runnable runnable) {
        // Snapshot the submitting thread's MDC at decoration time.
        Map<String, String> parent = ThreadContext.getImmutableContext();
        return () -> {
            // Save whatever the worker thread already had (usually empty, but
            // pool threads get reused — defensive restore prevents leakage).
            Map<String, String> previous = ThreadContext.getImmutableContext();
            try {
                ThreadContext.clearMap();
                if (parent != null && !parent.isEmpty()) {
                    ThreadContext.putAll(parent);
                }
                runnable.run();
            } finally {
                ThreadContext.clearMap();
                if (previous != null && !previous.isEmpty()) {
                    ThreadContext.putAll(previous);
                }
            }
        };
    }
}
