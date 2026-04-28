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
        public static final int RECHECK_INTERVAL_DAYS = 12;

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