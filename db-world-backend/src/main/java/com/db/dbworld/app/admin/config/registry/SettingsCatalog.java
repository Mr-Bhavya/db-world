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
    private static final String C_LIBRARY   = "Media Library";
    private static final String C_SCHEDULER = "Scheduler";
    private static final String C_SYSTEM_HEALTH = "System Health";

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
        str(CINEMA_AI_EDITORIAL_BASE_URL, C_CINEMA, "Ollama base URL",
            "Local Ollama server used for DB World editorial and recommendation generation.",
            "http://127.0.0.1:11434", false, 10),
        str(CINEMA_AI_EDITORIAL_MODEL, C_CINEMA, "Ollama model",
            "Installed Ollama model used for cinema editorial generation.",
            "qwen2.5:3b", false, 11),
        intg(CINEMA_AI_EDITORIAL_TIMEOUT_SECONDS, C_CINEMA, "AI request timeout (seconds)",
            "Maximum time allowed for a single local model response.", 180, 30L, 900L, 12),
        intg(CINEMA_AI_EDITORIAL_BATCH_SIZE, C_CINEMA, "Automatic batch size",
            "Maximum missing records generated in one nightly pass. Keep low on the Pi.",
            5, 1L, 20L, 13),

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
        str(IPO_IPOGURU_LIST_PATH, C_IPO, "IPO Guru list path",
            "Path appended to the IPO Guru base URL.", "/ipos", false, 5),
        str(IPO_NSE_HOME_PATH, C_IPO, "NSE bootstrap page path",
            "Browser-like page used to establish the NSE session cookie.", "/market-data/all-upcoming-issues-ipo", false, 6),
        str(IPO_NSE_CURRENT_PATH, C_IPO, "NSE current issues path",
            "Path for currently open IPOs.", "/api/ipo-current-issue", false, 7),
        str(IPO_NSE_UPCOMING_PATH, C_IPO, "NSE upcoming issues path",
            "Path for upcoming IPOs, including its query string.", "/api/all-upcoming-issues?category=ipo", false, 8),
        str(IPO_NSE_DETAIL_PATH, C_IPO, "NSE issue detail template",
            "Path template containing %s for symbol and %s for series.", "/api/ipo-detail?symbol=%s&series=%s", false, 9),
        str(IPO_NSE_HOLIDAY_PATH, C_IPO, "NSE holiday path",
            "Path for the annual trading-holiday feed.", "/api/holiday-master?type=trading", false, 10),
        str(IPO_CHITTORGARH_LIST_PATH, C_IPO, "Chittorgarh list template",
            "Path template: page, month, FY start, FY label.", "/cloud/report/data-read/82/%d/%d/%d/%s/0/all", false, 11),
        str(IPO_INVESTORGAIN_REPORT_PATH, C_IPO, "Investorgain report template",
            "Path template: page, month, FY start, FY label.", "/cloud/v2/report/data-read/394/%d/%d/%d/%s/0/all", false, 12),
        str(IPO_INVESTORGAIN_GMP_PATH, C_IPO, "Investorgain GMP detail template",
            "Path template containing the IPO id.", "/cloud/v2/ipo/ipo-gmp-read/%s/true", false, 13),
        str(IPO_INVESTORGAIN_SUBSCRIPTION_PATH, C_IPO, "Investorgain subscription template",
            "Path template containing the IPO id.", "/cloud/v2/ipo/ipo-subscription-read/%s", false, 14),
        str(IPO_INVESTORGAIN_LIVE_REPORT_PATH, C_IPO, "Investorgain live report template",
            "Path template: month, FY start, FY label.", "/cloud/v2/report/data-read/331/1/%d/%d/%s/0/all?search=", false, 15),
        str(IPO_INVESTORGAIN_DASHBOARD_PATH, C_IPO, "Investorgain GMP dashboard path",
            "Path for the aggregate live GMP dashboard.", "/cloud/v2/index/gmp-data", false, 16),
        str(IPO_INVESTORGAIN_DETAIL_PATH, C_IPO, "Investorgain live detail template",
            "Path template containing the numeric IPO id.", "/cloud/v2/ipo/ipo-gmp-read/%d/true", false, 17),
        lng(IPO_INVESTORGAIN_FETCH_BUDGET, C_IPO, "Investorgain fetches per pass",
            "How many per-IPO GMP/subscription detail calls one refresh pass may make. Candidates are "
                + "rotated least-recently-refreshed first within a priority tier (open, then upcoming, "
                + "then awaiting listing, then listed), so this controls how FAST every tracked IPO "
                + "comes round - not which ones ever do. Raise it if the logs report a rotation deeper "
                + "than about 4 passes; each fetch costs roughly half a second.",
            30L, 5L, 200L, 18),
        bool(IPO_GMP_NOTIFY_ENABLED, C_IPO, "Push GMP moves",
            "Send a push when an IPO's grey-market premium moves. OFF by default and best left off: "
                + "GMP is an unofficial number that moves all day, and pushing every move produced 28 "
                + "notifications in five hours - the same IPO alerting five times. GMP is still "
                + "collected, charted and shown in the app either way; this only controls the push.",
            false, 19),
        lng(IPO_GMP_NOTIFY_THRESHOLD_PCT, C_IPO, "GMP notify threshold (%)",
            "Minimum GMP% change that triggers a notification, measured against the last value we "
                + "actually notified about (not the last one polled - that is what let a drifting GMP "
                + "re-alert every single pass). Only applies when GMP pushes are enabled above.",
            25L, 0L, 100L, 20),
        lng(IPO_GMP_NOTIFY_MIN_ABSOLUTE, C_IPO, "GMP notify floor (Rs)",
            "A GMP move must ALSO be at least this many rupees to notify. Without a floor, the "
                + "percentage test alone fires on noise: a Rs 1 move on a Rs 3 GMP is a 33% jump and "
                + "worth nobody's attention. Only applies when GMP pushes are enabled above.",
            5L, 0L, 1000L, 21),
        lng(IPO_NOTIFY_COOLDOWN_HOURS, C_IPO, "Per-IPO alert cooldown (h)",
            "Minimum gap between two pushes about the SAME IPO and the same kind of event. Stops one "
                + "volatile IPO from dominating the day. 0 disables the cooldown.",
            6L, 0L, 168L, 22),
        lng(IPO_NOTIFY_MAX_PER_DAY, C_IPO, "Max IPO pushes per day",
            "Ceiling on IPO pushes sent in one IST day, across all IPOs. Once it is reached the rest "
                + "of the day's alerts are dropped rather than queued, so a feed glitch cannot empty a "
                + "backlog onto every device at once. 0 = no cap.",
            6L, 0L, 100L, 23),
        lng(IPO_NOTIFY_DIGEST_THRESHOLD, C_IPO, "Digest from N alerts",
            "When a single delivery pass has this many or more alerts of the same kind, they are sent "
                + "as ONE summary push (\"5 IPOs opened today\") instead of one push each. 2 bundles "
                + "aggressively; a high value effectively disables bundling.",
            2L, 2L, 50L, 24),
        lng(IPO_LIST_HIDE_LISTED_AFTER_DAYS, C_IPO, "Hide completed IPOs after (days)",
            "Hide listed IPOs, and stale closed IPOs with no confirmed listing result, after this many "
                + "days. 0 = never hide. Direct detail links still work.",
            30L, 0L, 3650L, 25),
        lng(IPO_NOTIFY_WINDOW_START_HOUR, C_IPO, "Notify window start (IST hour)",
            "Earliest IST hour (0–23) an IPO push may be sent. IPO bidding + listing trading both open "
                + "at 10 AM IST, so 10 is the natural default; earlier hours are suppressed.",
            10L, 0L, 23L, 26),
        lng(IPO_NOTIFY_WINDOW_END_HOUR, C_IPO, "Notify window end (IST hour)",
            "Latest IST hour (exclusive, 1–24) an IPO push may be sent; later hours are suppressed so no "
                + "notifications go out overnight. Must be greater than the start hour.",
            21L, 1L, 24L, 27),
        str(IPO_MARKET_HOLIDAYS, C_IPO, "NSE market holidays",
            "Non-trading days when IPO pushes are suppressed. Each comma-separated entry is either "
                + "YYYY-MM-DD (a one-off date) or MM-DD (recurs every year — fixed holidays like "
                + "01-26/08-15/12-25 never need updating). Seeded with NSE 2026 holidays; the lunar ones "
                + "are also auto-refreshed yearly from NSE (see below), and this list overrides/augments "
                + "that. Weekends are always skipped automatically.",
            DEFAULT_MARKET_HOLIDAYS, false, 28),
        str(IPO_MARKET_HOLIDAYS_AUTO, C_IPO, "NSE market holidays (auto-fetched)",
            "System-managed — auto-populated once a year from NSE's official trading-holiday feed and "
                + "unioned with the manual list above (which takes precedence). Normally leave this alone; "
                + "it repopulates on the next poll if cleared.",
            "", false, 29),

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
             true, 3),

        // ── Media Library ─────────────────────────────────────────────────
        intg(MEDIA_SYNC_MAX_REMOVAL_PERCENT, C_LIBRARY, "Max removal per scan (%)",
             "Largest share of the media library one MediaSync scan may remove because the files are "
             + "gone from disk. A scan that would remove more removes nothing and is recorded as FAILED, "
             + "so a media disk that is unmounted or failing cannot wipe every media record, symlink and "
             + "storyboard. Up to 5 removals are always allowed. If you really did delete that many files "
             + "over the share, raise this for one scan. 100 turns the limit off; an empty media folder "
             + "is refused regardless.",
             20, 1L, 100L, 0),

        // ── Scheduler ────────────────────────────────────────────────────
        intg(SCHEDULER_HISTORY_RETENTION_DAYS, C_SCHEDULER, "Run history retention (days)",
             "How long a job's run history is kept before the nightly prune deletes it. Applies to "
             + "every job except the high-frequency ones below.",
             30, 1L, 3650L, 0),
        intg(SCHEDULER_HISTORY_RETENTION_DAYS_FREQUENT, C_SCHEDULER, "Retention for frequent jobs (days)",
             "Shorter retention for jobs that run on a minutes-scale interval — MediaSync alone writes "
             + "a row every 60s, which is ~98% of all history. Keeping those as long as the daily jobs "
             + "buries the interesting runs and grows the table without bound.",
             3, 1L, 365L, 1),

        // ── System Health ────────────────────────────────────────────────
        bool(SYSTEM_HEALTH_ALERTS_ENABLED, C_SYSTEM_HEALTH, "Host health alerts",
             "Push admin phones when a host health check (disks, SMART, services, backups, "
             + "certificates) starts failing, when it recovers, every 24h while it stays failing, and "
             + "when the health report stops updating. Only changes notify, never every 5-minute "
             + "re-check. Also needs Push enabled.", true, 0),
        bool(SYSTEM_HEALTH_ALERT_ON_WARN, C_SYSTEM_HEALTH, "Alert on warnings too",
             "Also push when a check enters WARN, not only FAIL. Off by default: warnings such as "
             + "pending updates or a disk at 80% are worth seeing on the System Info page but rarely "
             + "worth a buzz.", false, 1)
    );

    private static final Map<String, SettingDefinition> BY_KEY =
            ALL.stream().collect(Collectors.toMap(SettingDefinition::key, Function.identity()));

    public static SettingDefinition byKey(String key) {
        return BY_KEY.get(key);
    }
}
