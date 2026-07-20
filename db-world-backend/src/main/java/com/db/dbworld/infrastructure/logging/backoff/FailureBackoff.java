package com.db.dbworld.infrastructure.logging.backoff;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Tracks consecutive failures of a single operation and tells the caller
 * whether to attempt the work and whether to surface a WARN this time.
 *
 * <p>Two problems this solves at once:
 * <ul>
 *   <li><b>Hot retry loop noise.</b> A scheduler tick that polls a missing file
 *       every 5s shouldn't WARN every 5s — it should WARN a few times, then
 *       fall silent (or downgrade to DEBUG) until something changes.</li>
 *   <li><b>Pointless work.</b> Once we know aria2 / a tail file is unavailable,
 *       most subsequent polls are wasted CPU. {@link #shouldAttempt()} returns
 *       {@code false} during the cooldown window so the caller can skip the
 *       work entirely.</li>
 * </ul>
 *
 * <p>Lifecycle:
 * <ul>
 *   <li>Caller asks {@link #shouldAttempt()} before doing work. If false, skip.</li>
 *   <li>On success, call {@link #recordSuccess()} — counters reset, future work
 *       runs immediately.</li>
 *   <li>On failure, call {@link #recordFailure()}; check
 *       {@link #shouldLogWarn()} to decide whether to emit a WARN this time.</li>
 * </ul>
 *
 * <p>Default tuning: first {@code logFirstN=3} failures log WARN, every
 * {@code logEveryNth=20}'th thereafter also logs WARN, others go to DEBUG.
 * After {@code failuresBeforeCooldown=10} consecutive failures, the operation
 * is skipped for {@code cooldown} duration. Tune per call site.
 *
 * <p>Thread-safe via atomics. A single instance is fine for one logical operation.
 */
public final class FailureBackoff {

    private final int  logFirstN;
    private final int  logEveryNth;
    private final int  failuresBeforeCooldown;
    private final long cooldownMs;

    private final AtomicInteger consecutiveFailures = new AtomicInteger(0);
    private final AtomicLong    cooldownUntilEpochMs = new AtomicLong(0L);

    /** Permissive defaults — good for most polling jobs. */
    public static FailureBackoff defaults() {
        return new FailureBackoff(3, 20, 10, Duration.ofMinutes(5));
    }

    /**
     * @param logFirstN              first N failures emit WARN unconditionally
     * @param logEveryNth            after the first N, only every Nth failure emits WARN
     * @param failuresBeforeCooldown after this many failures, skip work for {@code cooldown}
     * @param cooldown               how long to skip the work for once tripped
     */
    public FailureBackoff(int logFirstN, int logEveryNth, int failuresBeforeCooldown, Duration cooldown) {
        if (logFirstN < 0) throw new IllegalArgumentException("logFirstN must be >= 0");
        if (logEveryNth < 1) throw new IllegalArgumentException("logEveryNth must be >= 1");
        if (failuresBeforeCooldown < 1) throw new IllegalArgumentException("failuresBeforeCooldown must be >= 1");
        this.logFirstN              = logFirstN;
        this.logEveryNth            = logEveryNth;
        this.failuresBeforeCooldown = failuresBeforeCooldown;
        this.cooldownMs             = cooldown.toMillis();
    }

    /** True if the caller should attempt the work this tick. */
    public boolean shouldAttempt() {
        long until = cooldownUntilEpochMs.get();
        if (until == 0L) return true;
        if (System.currentTimeMillis() < until) return false;
        // Cooldown expired — clear it so subsequent failures start a fresh streak.
        cooldownUntilEpochMs.compareAndSet(until, 0L);
        return true;
    }

    public void recordSuccess() {
        consecutiveFailures.set(0);
        cooldownUntilEpochMs.set(0L);
    }

    /** Returns the new consecutive-failure count. */
    public int recordFailure() {
        int n = consecutiveFailures.incrementAndGet();
        if (n == failuresBeforeCooldown) {
            cooldownUntilEpochMs.set(System.currentTimeMillis() + cooldownMs);
        }
        return n;
    }

    /**
     * Whether the current failure should be logged at WARN (vs DEBUG).
     * Call AFTER {@link #recordFailure()}.
     */
    public boolean shouldLogWarn() {
        int n = consecutiveFailures.get();
        if (n <= logFirstN) return true;
        return (n - logFirstN) % logEveryNth == 0;
    }

    public int consecutiveFailures() {
        return consecutiveFailures.get();
    }

    /** Remaining cooldown in milliseconds, or 0 if not in cooldown. */
    public long cooldownRemainingMs() {
        long until = cooldownUntilEpochMs.get();
        if (until == 0L) return 0L;
        long remaining = until - System.currentTimeMillis();
        return Math.max(remaining, 0L);
    }
}
