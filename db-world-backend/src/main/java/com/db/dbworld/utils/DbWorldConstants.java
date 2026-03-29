package com.db.dbworld.utils;

import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

@Component
public class DbWorldConstants {

    private final DbWorldRuntimeProperties runtimeProperties;

    public DbWorldConstants(DbWorldRuntimeProperties runtimeProperties) {
        this.runtimeProperties = runtimeProperties;
    }

    // Roles
    public static final String OWNER = "OWNER";
    public static final String ADMIN = "ADMIN";
    public static final String VIEWER = "VIEWER";


    public enum RECORD_TYE {
        MOVIE, SERIES
    }

    // Streaming/download constants
    public static final int CHUNK_SIZE = 20 * 1024 * 1024; // 20 MB
    public static final String CONTENT_TYPE_HEADER = "Content-Type";
    public static final String CONTENT_LENGTH_HEADER = "Content-Length";
    public static final String CONTENT_RANGE_HEADER = "Content-Range";
    public static final String ACCEPT_RANGES_HEADER = "Accept-Ranges";
    public static final String BYTES = "bytes";
    public static final String CONTENT_DISPOSITION_HEADER = "Content-Disposition";
    public static final String CDN_STREAM_ID = "/cdn/stream/id/";
    public static final String CDN_STREAM_PATH = "/cdn/stream/path/";

    // Encryption
    public static final String KEY_FACTORY_ALGORITHM = "PBKDF2WithHmacSHA256";
    public static final String KEY_SPEC_ALGORITHM = "AES";
    public static final String ENCRYPT_ALGORITHM = "AES/CBC/PKCS5Padding";

    // YT-DLP
    public static final String YTDLP_COOKIES_CMD = "--cookies";
    public static final String HOTSTAR_COM = "hotstar.com";

    // Authorization expressions
    public static final String ALL_AUTHORIZE        = "hasAnyAuthority('OWNER', 'ADMIN', 'VIEWER')";
    public static final String OWNER_AUTHORIZE      = "hasAuthority('OWNER')";
    public static final String OWNER_ADMIN_AUTHORIZE = "hasAnyAuthority('OWNER', 'ADMIN')";

    // Public APIs
    public static final String[] PUBLIC_APIS = {
            "/api/server/**",
            "/api/hls/**",
            "/api/auth/**",
            "/api/logs/app/*/follow",
            "/test/**",
            "/dbworld-api-doc.html",
            "/swagger-ui/**",
            "/ws/status",
            "/ws/application-logs",
            "/ws/user-cinema-activity",
            "/api/stream/watch/**",
            "/api/stream/download/**",
            "/*", "/db-world/**", "/static/**",
            "/api/metrics/**", "/actuator/**", "/api/migration/**"
    };

    // Configured constants from application.yml
    public static String TMDB_API_KEY;
    public static String TMDB_ACCESS_TOKEN;
    public final static String TMDB_MOVIE_DETAILS_URL="https://api.themoviedb.org/3/movie/{tmdb_id}?append_to_response=videos,images,credits";
    public final static String TMDB_SERIES_DETAILS_URL = "https://api.themoviedb.org/3/tv/{tmdb_id}?append_to_response=videos,images,credits";
    public final static String TMDB_MOVIE_PROVIDER_URL = "https://api.themoviedb.org/3/movie/{tmdb_id}/watch/providers";
    public final static String TMDB_SERIES_PROVIDER_URL = "https://api.themoviedb.org/3/tv/{tmdb_id}/watch/providers";
    public final static String TMDB_SEARCH_MOVIE_PROVIDER_URL = "https://api.themoviedb.org/3/search/movie?query={query}&year={year}";
    public final static String TMDB_SEARCH_SERIES_PROVIDER_URL = "https://api.themoviedb.org/3/search/tv?query={query}&year={year}";
    public final static String TMDB_LANGUAGES_CONFIGURATION_URL = "https://api.themoviedb.org/3/configuration/languages";

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

        TEMP_DOWNLOAD_PATH = runtimeProperties.getTempPath().toString();
        LOGS_FILE_PATH = runtimeProperties.getLogsPath().toString();
        LOG4J2_FILE_PATH = runtimeProperties.getLogsPath().toString();
        DOWNLOAD_LOG_PATH = runtimeProperties.getDownloadLogPath().toString();
        INTEGRATION_FOLDER_PATH = runtimeProperties.getIntegrationPath().toString();
        STREAM_HOME_PATH = runtimeProperties.getStreamPath().toString();
        EXTERNAL_STREAM_HOME_PATH = runtimeProperties.getExternalVideosPath().toString();
        TORRENT_DOWNLOAD_HOME_PATH = runtimeProperties.getTorrentsPath().toString();
        EXTERNAL_H_DISK_PATH = runtimeProperties.getBasePath().toString();
        YT_DLP = runtimeProperties.getYtDlp();
        MEDIAINFO = runtimeProperties.getMediaInfo();
        HS_COOKIES_PATH = runtimeProperties.getHsCookies().toString();

        TMDB_API_KEY = runtimeProperties.getTmdbApiKey();
        TMDB_ACCESS_TOKEN = runtimeProperties.getTmdbAccessToken();
    }
}
