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

    // Document Wallet
    public static final String WALLET_MAX_FILE_SIZE_BYTES           = "wallet.max-file-size-bytes";
    public static final String WALLET_ALLOWED_CONTENT_TYPES         = "wallet.allowed-content-types";

    // Cinema catalog
    // When true, a DRAFT record is auto-published (and its "new title" push fires) the moment its
    // first media file finishes ingesting — otherwise an admin publishes it manually.
    public static final String CINEMA_RECORD_AUTO_PUBLISH           = "cinema.record.auto-publish-on-media";

    // IPO Tracker (IPO Guru API key is a SECRET — read from env IPO_GURU_API_KEY, not here)
    // Poll cadence is NOT a setting here — it lives in scheduler_job_config (job id "ipo-poll"),
    // admin-editable via the Scheduler page like every other cron job.
    public static final String IPO_SOURCES_ENABLED                  = "ipo.sources.enabled";
    public static final String IPO_IPOGURU_BASE_URL                 = "ipo.ipoguru.base-url";
    // Per-source API base URLs — the host+prefix each adapter prepends to its (in-code) path
    // templates, so a source can be repointed from the admin console without a redeploy if an
    // upstream host/path changes. Blank/unset falls back to the adapter's built-in default.
    public static final String IPO_NSE_BASE_URL                     = "ipo.nse.base-url";
    public static final String IPO_CHITTORGARH_BASE_URL             = "ipo.chittorgarh.base-url";
    public static final String IPO_INVESTORGAIN_BASE_URL            = "ipo.investorgain.base-url";
    public static final String IPO_GMP_NOTIFY_THRESHOLD_PCT         = "ipo.gmp.notify-threshold-pct";

    // Push notifications (FCM). The Firebase service-account credentials are a SECRET — read from
    // env (not a setting here), same as the IPO Guru API key.
    public static final String PUSH_ENABLED                         = "push.enabled";
    public static final String PUSH_IPO_TOPIC                       = "push.ipo.topic";
}
