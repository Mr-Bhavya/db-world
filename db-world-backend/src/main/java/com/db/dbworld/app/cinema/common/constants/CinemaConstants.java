package com.db.dbworld.app.cinema.common.constants;

import java.time.ZoneId;

public final class CinemaConstants {

    private CinemaConstants() {}

    /* =====================================
       TIME
     ===================================== */

    public static final class Time {

        private Time() {}

        public static final String ZONE_IST = "Asia/Kolkata";
        public static final ZoneId ZONE_ID_IST = ZoneId.of(ZONE_IST);
    }

    /* =====================================
       SCHEDULER
     ===================================== */

    public static final class Scheduler {

        private Scheduler() {}

        // Cron expressions
        public static final String DAILY_2AM    = "0 0 2 * * *";
        public static final String DAILY_2_10AM = "0 10 2 * * *";
        public static final String DAILY_3AM    = "0 0 3 * * *";

        // Safety
        public static final long INITIAL_DELAY_MS = 2 * 60 * 1000; // 2 min
    }

    /* =====================================
       TMDB SYNC
     ===================================== */

    public static final class TmdbSync {

        private TmdbSync() {}

        // Window config
        public static final int BUFFER_DAYS = 2;
        public static final int MAX_WINDOW_DAYS = 14;

        /**
         * Skip re-syncing a record checked more recently than this many HOURS, even when it
         * reappears in TMDB's /changes window (which overlaps by {@link #BUFFER_DAYS}).
         * <p>MUST be shorter than the sync job's cron period (daily) so a record that
         * genuinely changes again on a later day is still picked up. Overridable per job in
         * the DB via {@code scheduler_job_config.recheck_interval_hours}; this is the
         * code-side fallback when that column is null.
         * <p>NOTE: the old constant was {@code RECHECK_INTERVAL_DAYS} but was passed to
         * {@code Duration.ofHours(...)} — i.e. it was always hours, never days.
         */
        public static final int RECHECK_INTERVAL_HOURS = 20;

        /**
         * A {@code tmdb_record_sync} row stuck in {@code RUNNING} for longer than this many
         * HOURS is treated as a zombie from a crashed run ({@code markChecked} flips status
         * to RUNNING before the refresh) and becomes eligible to sync again. Comfortably
         * longer than any single record's processing time, far shorter than the daily cadence.
         */
        public static final int STALE_RUNNING_RECLAIM_HOURS = 2;

        // DB job ids (scheduler_job_config.job_id) for the two TMDB sync jobs.
        public static final String MOVIE_SYNC_JOB_ID = "TmdbMovieSync";
        public static final String TV_SYNC_JOB_ID    = "TmdbTvSync";

        // Rate limiting
        public static final long DELAY_MS = 120;        // ~8/sec
        public static final int PARALLELISM = 4;

        // Retry config (future use)
        public static final int MAX_RETRY = 3;

        // Performance tuning
        public static final int FETCH_BATCH_SIZE = 100;
    }

    /* =====================================
       SYSTEM
     ===================================== */

    public static final class System {

        private System() {}

        public static final String SYSTEM_USER = "SYSTEM";
    }
}