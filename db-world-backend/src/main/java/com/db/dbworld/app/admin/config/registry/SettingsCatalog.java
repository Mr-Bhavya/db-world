package com.db.dbworld.app.admin.config.registry;

import com.db.dbworld.app.admin.config.entity.ConfigValueType;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.db.dbworld.app.admin.config.registry.ConfigKeys.*;
import static com.db.dbworld.app.admin.config.registry.SettingDefinition.*;

/** The full set of runtime-editable settings, with defaults and UI metadata. */
public final class SettingsCatalog {
    private SettingsCatalog() {}

    private static final String C_RECOMMEND = "Recommendations";
    private static final String C_TRACKING  = "Activity Tracking";
    private static final String C_WEATHER   = "Weather";
    private static final String C_CDN       = "CDN Signing";
    private static final String C_WALLET    = "Document Wallet";
    private static final String C_CINEMA    = "Cinema";
    private static final String C_IPO       = "IPO Tracker";
    private static final String C_PUSH      = "Push Notifications";
    private static final String C_INGESTION = "Media Ingestion";

    /**
     * Default NSE market-holiday seed. Fixed-date national holidays are written as recurring
     * {@code MM-DD} so they apply every year with no maintenance; the variable lunar-calendar
     * holidays are dated {@code YYYY-MM-DD} for 2026 and must be refreshed annually from the official
     * NSE circular. Weekends are handled programmatically, so weekend-only holidays are omitted.
     */
    private static final String DEFAULT_MARKET_HOLIDAYS =
            // Recurring every year — fixed-date national holidays (Republic Day, Ambedkar Jayanti,
            // Maharashtra/Labour Day, Independence Day, Gandhi Jayanti, Christmas):
            "01-26,04-14,05-01,08-15,10-02,12-25,"
            // 2026 variable/lunar holidays — refresh annually:
            + "2026-01-15,2026-03-03,2026-03-26,2026-03-31,2026-04-03,2026-05-28,2026-06-26,"
            + "2026-09-14,2026-10-20,2026-11-10,2026-11-24";

    public static final List<SettingDefinition> ALL = List.of(
        // ── Recommendations ──────────────────────────────────────────────
        bool(RECOMMEND_GENRE_ENABLED, C_RECOMMEND, "Genre rail enabled",
             "Show the personalised genre recommendation rail.", true, 0),
        intg(RECOMMEND_GENRE_TOP_N, C_RECOMMEND, "Genre top-N",
             "Number of top genres surveyed when picking the rail's genre.", 3, 1L, 20L, 1),
        intg(RECOMMEND_GENRE_MIN_ENGAGED_RECORDS, C_RECOMMEND, "Genre min engaged records",
             "Minimum engaged records before the rail is shown (cold-start guard).", 3, 0L, 100L, 2),
        intg(RECOMMEND_GENRE_COMPLETION_THRESHOLD, C_RECOMMEND, "Genre completion threshold %",
             "completion_percent (0-100) that counts a record as engaged.", 70, 0L, 100L, 3),
        intg(RECOMMEND_GENRE_CACHE_TTL_MIN, C_RECOMMEND, "Genre cache TTL (min)",
             "Per-user cache TTL for the picked genre.", 60, 0L, 1440L, 4),
        bool(RECOMMEND_REWATCH_ENABLED, C_RECOMMEND, "Rewatch rail enabled",
             "Show the 'Popular rewatches this week' rail.", true, 5),
        str(RECOMMEND_REWATCH_REFRESH_CRON, C_RECOMMEND, "Rewatch refresh cron",
             "Spring 6-field cron for recomputing the rewatch list.", "0 0 * * * *", false, 6),
        intg(RECOMMEND_REWATCH_WINDOW_DAYS, C_RECOMMEND, "Rewatch window (days)",
             "Lookback window for rewatch scoring.", 7, 1L, 365L, 7),
        intg(RECOMMEND_REWATCH_MIN_SCORE, C_RECOMMEND, "Rewatch min score",
             "Minimum (download+stream) sum for inclusion.", 3, 0L, 1000L, 8),
        intg(RECOMMEND_REWATCH_TOP_N, C_RECOMMEND, "Rewatch top-N",
             "Max records cached for the rail.", 30, 1L, 200L, 9),

        // ── Activity Tracking ────────────────────────────────────────────
        bool(TRACKING_ENABLED, C_TRACKING, "Tracking enabled",
             "Master flag — gates all live tracking writes.", true, 0),
        // requiresRestart: cadence is baked into @Scheduled at startup (TrackingLogShipper),
        // so editing this only takes effect after a restart.
        new SettingDefinition(TRACKING_BATCH_TICK_MS, ConfigValueType.LONG, C_TRACKING, "Batch tick (ms)",
             "How often the shipper flushes accumulated CDN log lines. Takes effect after restart.",
             "5000", 100L, 600000L, true, 1),
        lng(TRACKING_MAX_BYTES_PER_TICK, C_TRACKING, "Max bytes per tick",
             "Cap on CDN log bytes processed per tick.", 5242880L, 0L, 1073741824L, 2),
        intg(TRACKING_MAX_ACCUMULATOR_ENTRIES, C_TRACKING, "Max accumulator entries",
             "Cap on in-memory accumulator entries per tick.", 10000, 0L, 1000000L, 3),
        intg(TRACKING_STREAM_TIMEOUT_MIN, C_TRACKING, "Stream session timeout (min)",
             "Idle minutes before a stream session is swept closed.", 15, 1L, 1440L, 4),
        intg(TRACKING_DOWNLOAD_TIMEOUT_MIN, C_TRACKING, "Download session timeout (min)",
             "Idle minutes before a download session is swept closed.", 30, 1L, 2880L, 5),
        // requiresRestart: cadence is baked into @Scheduled at startup (TrackingSweeper),
        // so editing this only takes effect after a restart.
        new SettingDefinition(TRACKING_SWEEPER_TICK_MS, ConfigValueType.LONG, C_TRACKING, "Sweeper tick (ms)",
             "How often the staleness sweeper runs. Takes effect after restart.",
             "60000", 1000L, 3600000L, true, 6),
        intg(TRACKING_EVENT_RETENTION_DAYS, C_TRACKING, "Event retention (days)",
             "How long activity events are kept before pruning.", 90, 1L, 3650L, 7),
        intg(TRACKING_SEARCH_PREFIX_COLLAPSE_SEC, C_TRACKING, "Search prefix collapse (sec)",
             "Collapse prefix-chain searches typed within this window.", 30, 0L, 3600L, 8),

        // ── Weather ──────────────────────────────────────────────────────
        intg(WEATHER_CACHE_TTL_SECONDS, C_WEATHER, "Weather cache TTL (sec)",
             "Cache TTL for OpenWeather responses.", 300, 0L, 86400L, 0),

        // ── CDN Signing ──────────────────────────────────────────────────
        bool(CDN_SIGNING_ENABLED, C_CDN, "CDN signing enabled",
             "WARNING: flipping this must be coordinated with the nginx secure_link "
             + "directive or playback/downloads break.", true, 0),
        intg(CDN_SIGNING_STREAM_TTL_SECONDS, C_CDN, "Stream URL TTL (sec)",
             "How long a signed streaming URL stays valid (covers a watch session).",
             21600, 60L, 604800L, 1),
        intg(CDN_SIGNING_DOWNLOAD_TTL_SECONDS, C_CDN, "Download URL TTL (sec)",
             "How long a signed download URL stays valid (copy-paste + resumed transfers).",
             172800, 60L, 2592000L, 2),

        // ── Document Wallet ───────────────────────────────────────────
        lng(WALLET_MAX_FILE_SIZE_BYTES, C_WALLET, "Max file size (bytes)",
            "Maximum upload size per wallet document.", 10_485_760L, 1_048_576L, 104_857_600L, 0),
        str(WALLET_ALLOWED_CONTENT_TYPES, C_WALLET, "Allowed content types",
            "Comma-separated MIME types accepted for wallet uploads.",
            "application/pdf,image/png,image/jpeg", false, 1),

        // ── Cinema ────────────────────────────────────────────────────────
        bool(CINEMA_RECORD_AUTO_PUBLISH, C_CINEMA, "Auto-publish on media",
             "When on, a draft record is automatically published — and its one-time \"new title\" push "
             + "sent — as soon as its first media file finishes ingesting. When off, an admin publishes "
             + "each record manually.", false, 0),

        // ── IPO Tracker ──────────────────────────────────────────────────
        str(IPO_SOURCES_ENABLED, C_IPO, "Enabled sources",
            "Comma-separated keys of enabled IPO data sources.",
            "ipoguru,nse,chittorgarh", false, 0),
        str(IPO_IPOGURU_BASE_URL, C_IPO, "IPO Guru base URL",
            "Base URL for the IPO Guru API.",
            "https://www.ipoguru.in/api/v1", false, 1),
        str(IPO_NSE_BASE_URL, C_IPO, "NSE base URL",
            "Base URL for the NSE IPO endpoints (e.g. …/api/ipo-current-issue, …/api/ipo-detail). "
                + "Blank restores the built-in default.",
            "https://www.nseindia.com", false, 2),
        str(IPO_CHITTORGARH_BASE_URL, C_IPO, "Chittorgarh base URL",
            "Base URL for the Chittorgarh list JSON API (the webnodejs host). "
                + "Blank restores the built-in default.",
            "https://webnodejs.chittorgarh.com", false, 3),
        str(IPO_INVESTORGAIN_BASE_URL, C_IPO, "Investorgain base URL",
            "Base URL for the Investorgain GMP report + gmp-read JSON API (the webnodejs host). "
                + "Blank restores the built-in default.",
            "https://webnodejs.investorgain.com", false, 4),
        lng(IPO_GMP_NOTIFY_THRESHOLD_PCT, C_IPO, "GMP notify threshold (%)",
            "Minimum GMP% change that triggers a notification.", 10L, 0L, 100L, 5),
        lng(IPO_LIST_HIDE_LISTED_AFTER_DAYS, C_IPO, "Hide listed after (days)",
            "Hide an IPO from the list once it listed more than this many days ago, so the list stays "
                + "current. 0 = never hide. Only affects already-listed IPOs with a known listing date.",
            30L, 0L, 3650L, 6),
        lng(IPO_NOTIFY_WINDOW_START_HOUR, C_IPO, "Notify window start (IST hour)",
            "Earliest IST hour (0–23) an IPO push may be sent. IPO bidding + listing trading both open "
                + "at 10 AM IST, so 10 is the natural default; earlier hours are suppressed.",
            10L, 0L, 23L, 7),
        lng(IPO_NOTIFY_WINDOW_END_HOUR, C_IPO, "Notify window end (IST hour)",
            "Latest IST hour (exclusive, 1–24) an IPO push may be sent; later hours are suppressed so no "
                + "notifications go out overnight. Must be greater than the start hour.",
            21L, 1L, 24L, 8),
        str(IPO_MARKET_HOLIDAYS, C_IPO, "NSE market holidays",
            "Non-trading days when IPO pushes are suppressed. Each comma-separated entry is either "
                + "YYYY-MM-DD (a one-off date) or MM-DD (recurs every year — fixed holidays like "
                + "01-26/08-15/12-25 never need updating). Seeded with NSE 2026 holidays; the lunar ones "
                + "are also auto-refreshed yearly from NSE (see below), and this list overrides/augments "
                + "that. Weekends are always skipped automatically.",
            DEFAULT_MARKET_HOLIDAYS, false, 9),
        str(IPO_MARKET_HOLIDAYS_AUTO, C_IPO, "NSE market holidays (auto-fetched)",
            "System-managed — auto-populated once a year from NSE's official trading-holiday feed and "
                + "unioned with the manual list above (which takes precedence). Normally leave this alone; "
                + "it repopulates on the next poll if cleared.",
            "", false, 10),

        // ── Push Notifications ────────────────────────────────────────────
        bool(PUSH_ENABLED, C_PUSH, "Push enabled",
             "Master flag — gates all outgoing push notifications (FCM). The Firebase service "
             + "account must also be configured via env for anything to actually send.", true, 0),
        str(PUSH_IPO_TOPIC, C_PUSH, "IPO push topic",
            "FCM topic every device is subscribed to on register; IPO alerts broadcast to it "
            + "(so every user is notified). Blank restores the built-in default.",
            "ipo-all", false, 1),
        lng(PUSH_TTL_SECONDS, C_PUSH, "Notification TTL (sec)",
            "How long FCM keeps trying to deliver a push before dropping it as stale — stops a device "
            + "that was offline for days from getting a flood of old notifications when it reconnects. "
            + "Applies to every push (Android/iOS/web). 86400 = 1 day; 0 = FCM default (~4 weeks).",
            86400L, 0L, 2419200L, 2),

        // ── Media Ingestion ───────────────────────────────────────────────
        bool(INGESTION_TRACK_REVIEW_ENABLED, C_INGESTION, "Track review enabled",
             "Master switch for the post-download audio/subtitle track review. When off, jobs that "
             + "requested review just apply the smart-default filter automatically (no prompt).", true, 0),
        intg(INGESTION_TRACK_REVIEW_TIMEOUT_MINUTES, C_INGESTION, "Track review timeout (min)",
             "How long a job waits for you to pick tracks before auto-applying the smart default and "
             + "continuing. The job holds no processing slot while it waits, so other jobs proceed.",
             30, 1L, 1440L, 1),
        intg(INGESTION_PROCESSING_THREADS, C_INGESTION, "Media processing CPU threads",
             "Max CPU threads for the heavy media tools — ffmpeg storyboard frame decode + 7z archive "
             + "extraction. 0 = use all cores. Lower it (e.g. 2 on a 4-core Pi) to keep the server "
             + "responsive during ingestion: processing takes longer but never pins every core. Takes "
             + "effect on the next job — no restart needed.",
             2, 0L, 64L, 2),
        bool(INGESTION_STORYBOARD_ENABLED, C_INGESTION, "Storyboard generation",
             "Generate the scrub-bar preview sprite (a thumbnail roughly every 10s of video) during "
             + "ingestion. Turn off to skip it entirely — noticeably less CPU/time per job, at the cost "
             + "of no hover-scrub thumbnails in the player for newly ingested files. Applies on the next job.",
             true, 3)
    );

    private static final Map<String, SettingDefinition> BY_KEY =
            ALL.stream().collect(Collectors.toMap(SettingDefinition::key, Function.identity()));

    public static SettingDefinition byKey(String key) {
        return BY_KEY.get(key);
    }
}
