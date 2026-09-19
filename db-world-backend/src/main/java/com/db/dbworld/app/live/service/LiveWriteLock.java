package com.db.dbworld.app.live.service;

import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Serialises every bulk write to the live-TV tables.
 *
 * <p>Three things write them and any two can overlap: the 6-hourly playlist import, the
 * 30-minute health sweep, and the admin's per-channel "test now" button. They contend on
 * {@code live_channel}'s unique {@code channel_key} index and on {@code
 * live_channel_source} rows, and MySQL resolves that with <em>Lock wait timeout
 * exceeded</em> after 50s — which on the import side rolls back the whole run, so a
 * refresh could appear to do nothing at all.
 *
 * <p>Holders declare what they are doing so the admin page can say whether something is
 * running, which is otherwise invisible: these are long operations behind fire-and-forget
 * buttons.
 */
@Log4j2
@Component
public class LiveWriteLock {

    private final ReentrantLock lock = new ReentrantLock();

    /** What currently holds it, and since when. Null when idle. */
    private volatile String activity;
    private volatile Instant since;

    /** A running operation, for the admin UI. */
    public record Activity(String what, Instant since, long seconds) {}

    /**
     * Take the lock only if it is free.
     *
     * <p>For the import: a second one has nothing to add, since the run already in flight
     * is importing the same playlists, so the caller is refused rather than queued.
     *
     * @return true when acquired — the caller MUST {@link #release()} in a finally block
     */
    public boolean tryAcquire(String what) {
        if (!lock.tryLock()) return false;
        mark(what);
        return true;
    }

    /**
     * Take the lock, waiting up to {@code timeout}.
     *
     * <p>For the health sweep's write: it has real results in hand and an import may
     * legitimately be holding the lock for minutes, so waiting beats discarding them.
     *
     * @return true when acquired — the caller MUST {@link #release()} in a finally block
     */
    public boolean acquire(String what, Duration timeout) {
        try {
            if (!lock.tryLock(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                log.warn("Live write lock busy with '{}' after {}s; '{}' gave up",
                        activity, timeout.toSeconds(), what);
                return false;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
        mark(what);
        return true;
    }

    public void release() {
        if (!lock.isHeldByCurrentThread()) return;
        // Only the outermost holder clears the label; the lock is reentrant.
        if (lock.getHoldCount() == 1) {
            activity = null;
            since = null;
        }
        lock.unlock();
    }

    /** What is running right now, or null. */
    public Activity current() {
        var what = activity;
        var start = since;
        if (what == null || start == null) return null;
        return new Activity(what, start, Duration.between(start, Instant.now()).toSeconds());
    }

    private void mark(String what) {
        if (lock.getHoldCount() == 1) {
            activity = what;
            since = Instant.now();
        }
    }
}
