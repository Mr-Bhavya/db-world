package com.db.dbworld.audit.tracking.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * Dedicated, bounded async executor for the tracking engine.
 *
 * <p>Audit telemetry (e.g. {@code TrackingIngestService.recordResolve}) must never compete
 * with or block the streaming resolve path. The shared {@code @Async} executor
 * ({@link com.db.dbworld.infrastructure.logging.mdc.MdcAsyncConfig}) uses
 * {@link ThreadPoolExecutor.CallerRunsPolicy} on saturation, which means under load a
 * tracking task can end up running inline on the caller thread — i.e. the
 * {@code /api/stream/resolve} request thread. That is back-pressure, and tracking is
 * best-effort telemetry, not a path that should ever push back on streaming.
 *
 * <p>This pool instead drops the oldest queued telemetry task under overload
 * ({@link ThreadPoolExecutor.DiscardOldestPolicy}), keeping streaming responsive at the
 * cost of losing some tracking data during spikes — an acceptable trade for telemetry.
 */
@Configuration
public class TrackingAsyncConfig {

    private static final int CORE_POOL_SIZE   = 2;
    private static final int MAX_POOL_SIZE    = 4;
    private static final int QUEUE_CAPACITY   = 500;
    private static final String THREAD_PREFIX = "dbw-tracking-";

    @Bean("trackingExecutor")
    public Executor trackingExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(CORE_POOL_SIZE);
        executor.setMaxPoolSize(MAX_POOL_SIZE);
        executor.setQueueCapacity(QUEUE_CAPACITY);
        executor.setThreadNamePrefix(THREAD_PREFIX);
        // Drop telemetry under overload rather than run on the caller — tracking must
        // never back-pressure the streaming resolve path.
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.DiscardOldestPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(10);
        executor.initialize();
        return executor;
    }
}
