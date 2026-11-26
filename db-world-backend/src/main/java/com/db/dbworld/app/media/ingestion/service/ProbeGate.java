package com.db.dbworld.app.media.ingestion.service;

import java.time.Duration;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/**
 * Bounds concurrent yt-dlp probes (each one is a heavyweight external process) and caches
 * successful results briefly so the same URL probed twice in a row only spawns one process.
 */
final class ProbeGate {

    @FunctionalInterface
    interface Probe<T> {
        T call() throws Exception;
    }

    private record Entry(Object value, long expiresAtNanos) {}

    private final Semaphore slots;
    private final Duration acquireTimeout;
    private final long ttlNanos;
    private final int maxEntries;
    private final Map<String, Entry> cache = new ConcurrentHashMap<>();

    ProbeGate(int maxConcurrent, Duration acquireTimeout, Duration ttl, int maxEntries) {
        this.slots = new Semaphore(maxConcurrent, true);
        this.acquireTimeout = acquireTimeout;
        this.ttlNanos = ttl.toNanos();
        this.maxEntries = maxEntries;
    }

    @SuppressWarnings("unchecked")
    <T> T run(String key, Probe<T> probe) {
        Entry hit = cache.get(key);
        if (hit != null && hit.expiresAtNanos() - System.nanoTime() > 0) {
            return (T) hit.value();
        }

        boolean acquired;
        try {
            acquired = slots.tryAcquire(acquireTimeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new YtFormatService.YtProbeException("Interrupted while waiting for a free probe slot", e);
        }
        if (!acquired) {
            throw new YtFormatService.YtProbeException(
                    "Format lookup is busy — too many probes running. Try again in a moment.");
        }

        try {
            // Another caller may have finished the same probe while we waited.
            hit = cache.get(key);
            if (hit != null && hit.expiresAtNanos() - System.nanoTime() > 0) {
                return (T) hit.value();
            }
            T value = probe.call();
            put(key, value);
            return value;
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new YtFormatService.YtProbeException(e.getMessage(), e);
        } finally {
            slots.release();
        }
    }

    private void put(String key, Object value) {
        long now = System.nanoTime();
        if (cache.size() >= maxEntries) {
            cache.values().removeIf(e -> e.expiresAtNanos() - now <= 0);
            Iterator<String> it = cache.keySet().iterator();
            while (cache.size() >= maxEntries && it.hasNext()) {
                it.next();
                it.remove();
            }
        }
        cache.put(key, new Entry(value, now + ttlNanos));
    }
}
