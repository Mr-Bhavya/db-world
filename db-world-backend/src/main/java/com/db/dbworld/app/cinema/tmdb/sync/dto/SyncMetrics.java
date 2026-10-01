package com.db.dbworld.app.cinema.tmdb.sync.dto;

import lombok.Getter;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;

@Getter
public class SyncMetrics {

    private final Instant startTime = Instant.now();

    /** Every id TMDB listed as changed in the window, ours or not. */
    private final AtomicInteger tmdbChanges = new AtomicInteger();
    /** Of those, the ones that are titles in our library: what the run actually works through. */
    private final AtomicInteger total = new AtomicInteger();
    private final AtomicInteger success = new AtomicInteger();
    private final AtomicInteger failed = new AtomicInteger();
    private final AtomicInteger skipped = new AtomicInteger();

    public void incrementTotal() {
        total.incrementAndGet();
    }

    public void incrementSuccess() {
        success.incrementAndGet();
    }

    public void incrementFailed() {
        failed.incrementAndGet();
    }

    public void incrementSkipped() {
        skipped.incrementAndGet();
    }

    public Duration duration() {
        return Duration.between(startTime, Instant.now());
    }

    public String summary() {
        return String.format(
                "TmdbChanges=%d, InLibrary=%d, Success=%d, Failed=%d, Skipped=%d, Duration=%ds",
                tmdbChanges.get(),
                total.get(),
                success.get(),
                failed.get(),
                skipped.get(),
                duration().toSeconds()
        );
    }
}