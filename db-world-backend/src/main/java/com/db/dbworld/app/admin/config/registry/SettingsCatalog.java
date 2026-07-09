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
    private static final String C_DOCS      = "API Docs";

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
        lng(TRACKING_BATCH_TICK_MS, C_TRACKING, "Batch tick (ms)",
             "How often the shipper flushes accumulated CDN log lines.", 5000L, 100L, 600000L, 1),
        lng(TRACKING_MAX_BYTES_PER_TICK, C_TRACKING, "Max bytes per tick",
             "Cap on CDN log bytes processed per tick.", 5242880L, 0L, 1073741824L, 2),
        intg(TRACKING_MAX_ACCUMULATOR_ENTRIES, C_TRACKING, "Max accumulator entries",
             "Cap on in-memory accumulator entries per tick.", 10000, 0L, 1000000L, 3),
        intg(TRACKING_STREAM_TIMEOUT_MIN, C_TRACKING, "Stream session timeout (min)",
             "Idle minutes before a stream session is swept closed.", 15, 1L, 1440L, 4),
        intg(TRACKING_DOWNLOAD_TIMEOUT_MIN, C_TRACKING, "Download session timeout (min)",
             "Idle minutes before a download session is swept closed.", 30, 1L, 2880L, 5),
        lng(TRACKING_SWEEPER_TICK_MS, C_TRACKING, "Sweeper tick (ms)",
             "How often the staleness sweeper runs.", 60000L, 1000L, 3600000L, 6),
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

        // ── API Docs ─────────────────────────────────────────────────────
        new SettingDefinition(SWAGGER_UI_ENABLED, ConfigValueType.BOOLEAN, C_DOCS,
            "Swagger UI enabled (restart required)",
            "Enable the /docs Swagger UI. springdoc binds this at startup, so a change only takes effect after a restart.",
            "false", null, null, true, 0)
    );

    private static final Map<String, SettingDefinition> BY_KEY =
            ALL.stream().collect(Collectors.toMap(SettingDefinition::key, Function.identity()));

    public static SettingDefinition byKey(String key) {
        return BY_KEY.get(key);
    }
}
