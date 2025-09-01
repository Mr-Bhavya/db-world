package com.db.dbworld.utils;

import com.db.dbworld.config.DbWorldPropertiesConfig;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

@Component
public class DbWorldConstants {

    private final DbWorldPropertiesConfig dbWorldPropertiesConfig;

    public DbWorldConstants(DbWorldPropertiesConfig dbWorldPropertiesConfig) {
        this.dbWorldPropertiesConfig = dbWorldPropertiesConfig;
    }

    // Roles
    public static final String OWNER = "OWNER";
    public static final String ADMIN = "ADMIN";
    public static final String VIEWER = "VIEWER";

    // Redis keys
    public static final String CUSTOM_REDIS_KEY_GENERATOR = "customRedisKeyGenerator";
    public static final String CUSTOM_REDIS_USER_KEY_GENERATOR = "customRedisUserKeyGenerator";

    // Replacement placeholders
    public static final String REPLACE_ID_STRING = "${id}";
    public static final String REPLACE_QUERY_STRING = "${query}";
    public static final String REPLACE_YEAR_STRING = "${year}";

    // Record types
    public static final String RECORD_TYPE_MOVIE = "movie";
    public static final String RECORD_TYPE_SERIES = "series";

    // Streaming/download constants
    public static final int CHUNK_SIZE = 20 * 1024 * 1024; // 20 MB
    public static final String CONTENT_TYPE_HEADER = "Content-Type";
    public static final String CONTENT_LENGTH_HEADER = "Content-Length";
    public static final String CONTENT_RANGE_HEADER = "Content-Range";
    public static final String ACCEPT_RANGES_HEADER = "Accept-Ranges";
    public static final String BYTES = "bytes";
    public static final String CONTENT_DISPOSITION_HEADER = "Content-Disposition";

    // TMDB keys
    public static final String TMDB_VIDEOS_PROPERTY_KEY = "videos";
    public static final String TMDB_RESULTS_PROPERTY_KEY = "results";
    public static final String TMDB_RENT_PROPERTY_KEY = "rent";
    public static final String TMDB_BUY_PROPERTY_KEY = "buy";
    public static final String TMDB_FLATRATE_PROPERTY_KEY = "flatrate";
    public static final String TMDB_IN_PROPERTY_KEY = "IN";
    public static final String TMDB_TITLE_PROPERTY_KEY = "title";
    public static final String TMDB_ORIGINAL_TITLE_PROPERTY_KEY = "original_title";
    public static final String TMDB_NAME_PROPERTY_KEY = "name";
    public static final String TMDB_ORIGINAL_NAME_PROPERTY_KEY = "original_name";
    public static final String PROVIDERS_PROPERTY_KEY = "providers";

    // User actions
    public static final String PROCESS_LIKE = "LIKE";
    public static final String PROCESS_UN_LIKE = "UNLIKE";
    public static final String PROCESS_WATCH = "WATCH";
    public static final String PROCESS_UN_WATCH = "UNWATCH";
    public static final String PROCESS_WATCHLIST = "WATCHLIST";
    public static final String PROCESS_UN_WATCHLIST = "UNWATCHLIST";

    // Encryption
    public static final String KEY_FACTORY_ALGORITHM = "PBKDF2WithHmacSHA256";
    public static final String KEY_SPEC_ALGORITHM = "AES";
    public static final String ENCRYPT_ALGORITHM = "AES/CBC/PKCS5Padding";

    // YT-DLP
    public static final String YTDLP_COOKIES_CMD = "--cookies";
    public static final String HOTSTAR_COM = "hotstar.com";

    // Authorization expressions
    public static final String ALL_AUTHORIZE = "hasAuthority('" + OWNER + "') || hasAuthority('" + ADMIN + "') || hasAuthority('" + VIEWER + "')";
    public static final String OWNER_AUTHORIZE = "hasAuthority('" + OWNER + "')";
    public static final String OWNER_ADMIN_AUTHORIZE = "hasAuthority('" + OWNER + "') || hasAuthority('" + ADMIN + "')";

    // Public APIs
    public static final String[] PUBLIC_APIS = {
            "/api/auth/**",
            "/test/**",
            "/dbworld-api-doc.html",
            "/swagger-ui/**",
            "/ws/status",
            "/ws/application-logs",
            "/ws/download-tracker",
            "/api/stream/watch/**",
            "/api/stream/download/**",
            "/*", "/db-world/**", "/static/**",
            "/api/metrics/**", "/actuator/**", "/api/migration/**"
    };

    // Configured constants from application.yml
    public static String TMDB_API_KEY;
    public static String TMDB_MOVIE_DETAILS_URL;
    public static String TMDB_SERIES_DETAILS_URL;
    public static String TMDB_MOVIE_PROVIDER_URL;
    public static String TMDB_SERIES_PROVIDER_URL;
    public static String TMDB_SEARCH_MOVIE_PROVIDER_URL;
    public static String TMDB_SEARCH_SERIES_PROVIDER_URL;

    public static String MEDIAINFO;
    public static String TEMP_DOWNLOAD_PATH;
    public static String LOGS_FILE_PATH;
    public static String LOG4J2_FILE_PATH;
    public static String DOWNLOAD_LOG_PATH;
    public static String STREAM_HOME_PATH;
    public static String INTEGRATION_FOLDER_PATH;
    public static String EXTERNAL_STREAM_HOME_PATH;
    public static String EXTERNAL_H_DISK_PATH;
    public static String TORRENT_DOWNLOAD_HOME_PATH;
    public static String HS_COOKIES_PATH;
    public static String YT_DLP;

    public enum FileAccessType {
        STREAM, DOWNLOAD
    }

    @PostConstruct
    public void initConstants() {
        var paths = dbWorldPropertiesConfig.getPaths();
        var tools = dbWorldPropertiesConfig.getTools();

        TEMP_DOWNLOAD_PATH = paths.getTemp();
        LOGS_FILE_PATH = paths.getMainLog();
        LOG4J2_FILE_PATH = paths.getArchivedLogs();
        DOWNLOAD_LOG_PATH = paths.getDownloadLog();
        INTEGRATION_FOLDER_PATH = paths.getIntegration();
        STREAM_HOME_PATH = dbWorldPropertiesConfig.getStreamPath();
        EXTERNAL_STREAM_HOME_PATH = paths.getExternalVideos();
        TORRENT_DOWNLOAD_HOME_PATH = paths.getTorrents();
        EXTERNAL_H_DISK_PATH = dbWorldPropertiesConfig.getDataPath();
        YT_DLP = tools.getYtDlp();
        MEDIAINFO = tools.getMediainfo();
        HS_COOKIES_PATH = tools.getHsCookies();

        TMDB_API_KEY = dbWorldPropertiesConfig.getApiKeys() != null ? dbWorldPropertiesConfig.getApiKeys().getTmdb() : null;
        createTmdbUrls(TMDB_API_KEY);
    }

    private void createTmdbUrls(String tmdbApiKey) {
        if (tmdbApiKey == null) return;

        TMDB_MOVIE_DETAILS_URL = "https://api.themoviedb.org/3/movie/" + REPLACE_ID_STRING +
                "?api_key=" + tmdbApiKey + "&append_to_response=videos,images,credits";
        TMDB_SERIES_DETAILS_URL = "https://api.themoviedb.org/3/tv/" + REPLACE_ID_STRING +
                "?api_key=" + tmdbApiKey + "&append_to_response=videos,images,credits";
        TMDB_MOVIE_PROVIDER_URL = "https://api.themoviedb.org/3/movie/" + REPLACE_ID_STRING +
                "/watch/providers?api_key=" + tmdbApiKey;
        TMDB_SERIES_PROVIDER_URL = "https://api.themoviedb.org/3/tv/" + REPLACE_ID_STRING +
                "/watch/providers?api_key=" + tmdbApiKey;
        TMDB_SEARCH_MOVIE_PROVIDER_URL = "https://api.themoviedb.org/3/search/movie?api_key=" + tmdbApiKey +
                "&query=" + REPLACE_QUERY_STRING + "&year=" + REPLACE_YEAR_STRING;
        TMDB_SEARCH_SERIES_PROVIDER_URL = "https://api.themoviedb.org/3/search/tv?api_key=" + tmdbApiKey +
                "&query=" + REPLACE_QUERY_STRING + "&year=" + REPLACE_YEAR_STRING;
    }
}
