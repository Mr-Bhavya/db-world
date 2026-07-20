package com.db.dbworld.audit.tracking.ingest;

import lombok.extern.log4j.Log4j2;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

/**
 * Dependency-free bounded retry for optimistic-lock collisions on session read-modify-write.
 * The nginx shipper and client API paths both touch the same {@code activity_session} row
 * concurrently; a version clash is expected and should be retried against a freshly reloaded
 * row rather than surfaced as a failure.
 */
@Log4j2
public final class OptimisticRetry {

    private static final int MAX_ATTEMPTS = 3;

    private OptimisticRetry() {
    }

    /** Runs {@code body}, retrying on optimistic lock failure up to {@value #MAX_ATTEMPTS} attempts total. */
    public static void run(Runnable body) {
        ObjectOptimisticLockingFailureException lastFailure = null;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                body.run();
                return;
            } catch (ObjectOptimisticLockingFailureException ex) {
                lastFailure = ex;
                log.debug("tracking: optimistic lock collision, attempt {}/{}", attempt, MAX_ATTEMPTS);
            }
        }
        throw lastFailure;
    }
}
