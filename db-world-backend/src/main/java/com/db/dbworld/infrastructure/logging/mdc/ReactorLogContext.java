package com.db.dbworld.infrastructure.logging.mdc;

import io.micrometer.context.ContextRegistry;
import io.micrometer.context.ThreadLocalAccessor;
import org.apache.logging.log4j.ThreadContext;
import reactor.core.publisher.Hooks;

import java.util.Map;

/**
 * Carries the Log4j2 {@link ThreadContext} across Reactor and Netty threads.
 *
 * <p>A scheduled job tags its own thread with {@code jobRunId}, but everything a WebClient call
 * logs once the request is out (the response line, a 404, each retry, "retries exhausted") runs
 * on a {@code reactor-http-nio}, {@code parallel} or {@code boundedElastic} thread with an empty
 * ThreadContext. Those lines carried no {@code jobRunId}, so the Scheduler page's run log could
 * never find them; the same went for {@code traceId} on calls made from a request.
 *
 * <p>Automatic context propagation snapshots the ThreadContext when a pipeline is subscribed or
 * blocked on, and restores it on whichever thread a signal is delivered, putting the thread's
 * own values back afterwards.
 */
public final class ReactorLogContext {

    private ReactorLogContext() {}

    /** Call once at startup, before the first {@code Mono}/{@code Flux} is assembled. */
    public static void install() {
        ContextRegistry.getInstance().registerThreadLocalAccessor(new ThreadContextAccessor());
        Hooks.enableAutomaticContextPropagation();
    }

    /** The whole ThreadContext map as one value: jobRunId, job, traceId, requestId, user... */
    static final class ThreadContextAccessor implements ThreadLocalAccessor<Map<String, String>> {

        static final String KEY = "log4j2.ThreadContext";

        @Override
        public Object key() {
            return KEY;
        }

        /** Null when empty, so a thread with nothing to carry adds nothing to the Context. */
        @Override
        public Map<String, String> getValue() {
            Map<String, String> current = ThreadContext.getImmutableContext();
            return current.isEmpty() ? null : current;
        }

        @Override
        public void setValue(Map<String, String> value) {
            ThreadContext.clearMap();
            ThreadContext.putAll(value);
        }

        @Override
        public void setValue() {
            ThreadContext.clearMap();
        }
    }
}
