package com.db.dbworld.app.admin.config.registry;

/** Canonical dotted keys for every managed setting. Referenced by the catalog and consumers. */
public final class ConfigKeys {
    private ConfigKeys() {}

    // Recommendations
    public static final String RECOMMEND_GENRE_ENABLED              = "recommend.genre.enabled";
    public static final String RECOMMEND_GENRE_TOP_N                = "recommend.genre.top-n";
    public static final String RECOMMEND_GENRE_MIN_ENGAGED_RECORDS  = "recommend.genre.min-engaged-records";
    public static final String RECOMMEND_GENRE_COMPLETION_THRESHOLD = "recommend.genre.completion-threshold";
    public static final String RECOMMEND_GENRE_CACHE_TTL_MIN        = "recommend.genre.cache-ttl-min";
    public static final String RECOMMEND_REWATCH_ENABLED            = "recommend.rewatch.enabled";
    public static final String RECOMMEND_REWATCH_REFRESH_CRON       = "recommend.rewatch.refresh-cron";
    public static final String RECOMMEND_REWATCH_WINDOW_DAYS        = "recommend.rewatch.window-days";
    public static final String RECOMMEND_REWATCH_MIN_SCORE          = "recommend.rewatch.min-score";
    public static final String RECOMMEND_REWATCH_TOP_N              = "recommend.rewatch.top-n";

    // Tracking
    public static final String TRACKING_ENABLED                     = "tracking.enabled";
    public static final String TRACKING_BATCH_TICK_MS               = "tracking.batch-tick-ms";
    public static final String TRACKING_MAX_BYTES_PER_TICK          = "tracking.max-bytes-per-tick";
    public static final String TRACKING_MAX_ACCUMULATOR_ENTRIES     = "tracking.max-accumulator-entries";
    public static final String TRACKING_STREAM_TIMEOUT_MIN          = "tracking.stream-timeout-min";
    public static final String TRACKING_DOWNLOAD_TIMEOUT_MIN        = "tracking.download-timeout-min";
    public static final String TRACKING_SWEEPER_TICK_MS             = "tracking.sweeper-tick-ms";
    public static final String TRACKING_EVENT_RETENTION_DAYS        = "tracking.event-retention-days";
    public static final String TRACKING_SEARCH_PREFIX_COLLAPSE_SEC  = "tracking.search-prefix-collapse-sec";

    // Weather
    public static final String WEATHER_CACHE_TTL_SECONDS            = "weather.openweather.cache-ttl-seconds";

    // CDN signing (secret stays in env — NOT here)
    public static final String CDN_SIGNING_ENABLED                  = "app.cdn.signing.enabled";
    public static final String CDN_SIGNING_STREAM_TTL_SECONDS       = "app.cdn.signing.stream-ttl-seconds";
    public static final String CDN_SIGNING_DOWNLOAD_TTL_SECONDS     = "app.cdn.signing.download-ttl-seconds";

    // API docs (restart-required)
    public static final String SWAGGER_UI_ENABLED                   = "springdoc.swagger-ui.enabled";
}
