package com.db.dbworld.app.admin.scheduler.dto;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Structured outcome of one scheduler run, persisted as JSON on the history row.
 *
 * <p>Before this existed a successful run recorded nothing but its duration, so the
 * admin history read {@code TmdbMovieSync · SUCCESS · 411,507 ms} — with no way to tell
 * whether it updated 400 records or none. Every job already computed these numbers
 * internally and dropped them on the floor; this is the carrier that gets them onto the
 * row.
 *
 * <p>The counters are a free-form ordered map rather than fixed fields because the jobs
 * have nothing in common — MediaSync counts files added/removed, the TMDB syncs count
 * records success/failed/skipped, the IPO poll counts sources. Insertion order is the
 * display order in the admin UI.
 *
 * @param counters ordered counter name → value; never null, possibly empty
 * @param note     short human-readable line shown beneath the counters; nullable
 */
public record JobRunSummary(Map<String, Long> counters, String note) {

    /** A run that reported nothing — used for jobs with no metrics and as a failure placeholder. */
    public static final JobRunSummary NONE = new JobRunSummary(Map.of(), null);

    public JobRunSummary {
        counters = (counters == null) ? Map.of() : Collections.unmodifiableMap(new LinkedHashMap<>(counters));
    }

    public boolean isEmpty() {
        return counters.isEmpty() && (note == null || note.isBlank());
    }

    public static Builder builder() {
        return new Builder();
    }

    /**
     * Accumulates counters in insertion order. Not thread-safe: a job builds its summary
     * on the run thread after the work is done, never concurrently.
     */
    public static final class Builder {
        private final Map<String, Long> counters = new LinkedHashMap<>();
        private String note;
        private volatile Supplier<Map<String, Long>> progress;

        /**
         * Registers a live view of this run's counters, read by the admin page WHILE the
         * job is still going.
         *
         * <p>A supplier rather than incremental {@code count()} calls, because the numbers a
         * long job wants to report already live in something it is mutating as it works
         * ({@code SyncMetrics}'s atomics, a batch loop's running totals). Handing over a
         * reader avoids making every loop iteration reach back into this builder.
         *
         * <p>The supplier is called from the HTTP thread while the job thread runs, so it
         * must read thread-safe state — atomics, not plain locals. Only the supplier is
         * exposed live; {@link #counters} itself is never read across threads.
         */
        public Builder progress(Supplier<Map<String, Long>> supplier) {
            this.progress = supplier;
            return this;
        }

        public Builder count(String name, long value) {
            counters.put(name, value);
            return this;
        }

        /** Convenience for the many {@code int} counters the jobs already track. */
        public Builder count(String name, int value) {
            return count(name, (long) value);
        }

        public Builder note(String note) {
            this.note = note;
            return this;
        }

        public JobRunSummary build() {
            return new JobRunSummary(counters, note);
        }

        /**
         * Counters as they stand right now, for a run still in flight. Empty when the job
         * registered no {@link #progress} supplier — such a job simply shows elapsed time
         * instead of progress, which is better than showing numbers that never move.
         */
        public Map<String, Long> liveCounters() {
            Supplier<Map<String, Long>> p = progress;
            if (p == null) return Map.of();
            try {
                Map<String, Long> live = p.get();
                return live == null ? Map.of() : live;
            } catch (Exception e) {
                // Progress reporting must never be able to break the page that reads it.
                return Map.of();
            }
        }
    }
}
