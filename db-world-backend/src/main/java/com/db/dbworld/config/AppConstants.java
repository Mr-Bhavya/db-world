package com.db.dbworld.config;

/**
 * Application-wide constants. Pure static class — no Spring beans, no mutable state.
 * Runtime-resolved values (paths, tool locations, API keys) live in {@link AppProperties}.
 */
public final class AppConstants {

    private AppConstants() {}

    // ── Roles ─────────────────────────────────────────────────────────────────

    public static final String OWNER  = "OWNER";
    public static final String ADMIN  = "ADMIN";
    public static final String VIEWER = "VIEWER";

    // ── Record types ──────────────────────────────────────────────────────────

    public enum RecordType { MOVIE, SERIES }

    // ── File access ───────────────────────────────────────────────────────────

    public enum FileAccessType { STREAM, DOWNLOAD }

    // ── Streaming / download ──────────────────────────────────────────────────

    public static final int    CHUNK_SIZE               = 20 * 1024 * 1024; // 20 MB
    public static final String CONTENT_TYPE_HEADER      = "Content-Type";
    public static final String CONTENT_LENGTH_HEADER    = "Content-Length";
    public static final String CONTENT_RANGE_HEADER     = "Content-Range";
    public static final String ACCEPT_RANGES_HEADER     = "Accept-Ranges";
    public static final String BYTES                    = "bytes";
    public static final String CONTENT_DISPOSITION_HEADER = "Content-Disposition";

    // ── CDN paths (nginx internal / external URL prefixes) ────────────────────

    public static final String CDN_STREAM_ID   = "/cdn/stream/id/";
    public static final String CDN_STREAM_PATH = "/cdn/stream/path/";

    public static final String CDN_URL_ID_PATH   = "/id/";
    public static final String CDN_URL_PATH_PATH = "/path/";

    // ── Encryption ────────────────────────────────────────────────────────────

    public static final String KEY_FACTORY_ALGORITHM = "PBEWithMD5AndDES";
    public static final String KEY_SPEC_ALGORITHM    = "AES";
    public static final String ENCRYPT_ALGORITHM     = "AES/CBC/PKCS5Padding";

    // ── YT-DLP ────────────────────────────────────────────────────────────────

    public static final String YTDLP_COOKIES_CMD = "--cookies";
    public static final String HOTSTAR_COM        = "hotstar.com";

    /**
     * Platforms that typically require cookies for format listing and download.
     * Used by AppProperties.getCookieForUrl() and YtFormatService.
     * Cookie files must live at: <cookiesDir>/<domain-prefix>.txt
     */
    public static final java.util.List<String> YTDLP_COOKIE_DOMAINS = java.util.List.of(
            "hotstar.com",
            "sonyliv.com",
            "zee5.com",
            "jiocinema.com",
            "voot.com",
            "primevideo.com",
            "netflix.com",
            "disneyplus.com"
    );

    // ── Authorization expressions (must be compile-time constants for @PreAuthorize) ──

    public static final String ALL_AUTHORIZE          = "hasAnyAuthority('OWNER', 'ADMIN', 'VIEWER')";
    public static final String OWNER_AUTHORIZE        = "hasAuthority('OWNER')";
    public static final String OWNER_ADMIN_AUTHORIZE  = "hasAnyAuthority('OWNER', 'ADMIN')";

    // ── Public (unauthenticated) API paths ────────────────────────────────────

    public static final String[] PUBLIC_APIS = {
            "/api/server/**",
            "/api/cinema/admin/bootstrap",
            "/assets/**",
            "/icons/**",
            "/scrrenshots/**",
            "/shortcuts/**",
            "/api/auth/**",
            "/api/logs/app/*/follow",
            "/test/**",
            "/dbworld-api-doc.html",
            "/swagger-ui/**",
            "/ws/status",
            "/ws/application-logs",
            "/ws/user-cinema-activity",
            "/api/stream/resolve/**",
            "/*", "/db-world/**", "/static/**",
            "/api/metrics/**", "/actuator/**", "/api/migration/**",
            "/api/admin/file-manager/download/stream"
    };

    // ── TMDB API URLs ─────────────────────────────────────────────────────────

    public static final String TMDB_MOVIE_DETAILS_URL =
            "https://api.themoviedb.org/3/movie/{tmdb_id}?append_to_response=videos,images,credits";
    public static final String TMDB_SERIES_DETAILS_URL =
            "https://api.themoviedb.org/3/tv/{tmdb_id}?append_to_response=videos,images,credits";
    public static final String TMDB_MOVIE_PROVIDER_URL =
            "https://api.themoviedb.org/3/movie/{tmdb_id}/watch/providers";
    public static final String TMDB_SERIES_PROVIDER_URL =
            "https://api.themoviedb.org/3/tv/{tmdb_id}/watch/providers";
    public static final String TMDB_SEARCH_MOVIE_URL =
            "https://api.themoviedb.org/3/search/movie?query={query}&year={year}";
    public static final String TMDB_SEARCH_SERIES_URL =
            "https://api.themoviedb.org/3/search/tv?query={query}&year={year}";
    public static final String TMDB_LANGUAGES_URL =
            "https://api.themoviedb.org/3/configuration/languages";
}
