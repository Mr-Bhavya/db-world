package com.db.dbworld.infrastructure.logging.mdc;

import lombok.extern.log4j.Log4j2;
import org.springframework.aop.interceptor.AsyncUncaughtExceptionHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskDecorator;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Configures the shared {@code @Async} executor so that:
 * <ol>
 *   <li>MDC propagates from the submitter thread into the worker thread
 *       (via {@link MdcTaskDecorator}).</li>
 *   <li>Uncaught exceptions in {@code void} async methods are logged with
 *       full context, not silently dropped.</li>
 *   <li>Pool size and queue capacity are explicit, not the
 *       {@code SimpleAsyncTaskExecutor} default (new thread per task).</li>
 * </ol>
 */
@Configuration
@Log4j2
public class MdcAsyncConfig implements AsyncConfigurer {

    private static final int CORE_POOL_SIZE  = 8;
    private static final int MAX_POOL_SIZE   = 32;
    private static final int QUEUE_CAPACITY  = 200;
    private static final String THREAD_PREFIX = "dbw-async-";

    @Bean
    public TaskDecorator mdcTaskDecorator() {
        return new MdcTaskDecorator();
    }

    @Override
    @Bean(name = "taskExecutor")
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(CORE_POOL_SIZE);
        executor.setMaxPoolSize(MAX_POOL_SIZE);
        executor.setQueueCapacity(QUEUE_CAPACITY);
        executor.setThreadNamePrefix(THREAD_PREFIX);
        executor.setTaskDecorator(mdcTaskDecorator());
        // Block the caller when the queue is full rather than dropping work —
        // back-pressure beats silent loss for audit/log tasks.
        executor.setRejectedExecutionHandler(new java.util.concurrent.ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(15);
        executor.initialize();
        return executor;
    }

    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (ex, method, params) ->
                log.error("Uncaught exception in @Async {}.{}({}): {}",
                        method.getDeclaringClass().getSimpleName(),
                        method.getName(),
                        params.length,
                        ex.getMessage(),
                        ex);
    }
}
