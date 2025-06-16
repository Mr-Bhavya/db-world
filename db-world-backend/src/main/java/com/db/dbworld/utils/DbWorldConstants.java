package com.db.dbworld.utils;

import com.db.dbworld.config.DbWorldPropertiesConfig;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

@Service
public class DbWorldConstants {

    private final DbWorldPropertiesConfig dbWorldPropertiesConfig;

    public DbWorldConstants(DbWorldPropertiesConfig dbWorldPropertiesConfig) {
        this.dbWorldPropertiesConfig = dbWorldPropertiesConfig;
    }

    public static final String OWNER = "OWNER";
    public static final String ADMIN = "ADMIN";
    public static final String VIEWER = "VIEWER";
    public static final String CUSTOM_REDIS_KEY_GENERATOR = "customRedisKeyGenerator";
    public static final String CUSTOM_REDIS_USER_KEY_GENERATOR = "customRedisUserKeyGenerator";
    public static final String REPLACE_ID_STRING = "${id}";
    public static final String REPLACE_QUERY_STRING = "${query}";
    public static final String REPLACE_YEAR_STRING = "${year}";
    public static final String RECORD_TYPE_MOVIE = "movie";
    public static final String RECORD_TYPE_SERIES = "series";
    public static final int CHUNK_SIZE = 1024 * 1024 * 20; //20 MB
    public static final String CONTENT_TYPE_HEADER = "Content-Type";
    public static final String CONTENT_LENGTH_HEADER = "Content-Length";
    public static final String CONTENT_RANGE_HEADER = "Content-Range";
    public static final String ACCEPT_RANGES_HEADER = "Accept-Ranges";
    public static final String BYTES = "bytes";
    public static final String CONTENT_DISPOSITION_HEADER = "Content-Disposition";
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
    public static final String PROCESS_LIKE = "LIKE";
    public static final String PROCESS_UN_LIKE = "UNLIKE";
    public static final String PROCESS_WATCH = "WATCH";
    public static final String PROCESS_UN_WATCH = "UNWATCH";
    public static final String PROCESS_WATCHLIST = "WATCHLIST";
    public static final String PROCESS_UN_WATCHLIST = "UNWATCHLIST";
    public static final String KEY_FACTORY_ALGORITHM = "PBKDF2WithHmacSHA256";
    public static final String KEY_SPEC_ALGORITHM = "AES";
    public static final String ENCRYPT_ALGORITHM = "AES/CBC/PKCS5Padding";
    public static final String YTDLP_COOKIES_CMD = "--cookies";
    public static final String HOTSTAR_COM = "hotstar.com";
    public static final String ALL_AUTHORIZE = "hasAuthority('" + OWNER + "')" + "||" + "hasAuthority('" + ADMIN + "')" + "||" + "hasAuthority('" + VIEWER + "')";
    public static final String OWNER_AUTHORIZE = "hasAuthority('" + OWNER + "')";
    public static final String OWNER_ADMIN_AUTHORIZE = "hasAuthority('" + OWNER + "')" + "||" + "hasAuthority('" + ADMIN + "')";
    public static final String[] PUBLIC_APIS = new String[]{
            "/api/auth/**",
            "/test/**",
            "/dbworld-api-doc.html",
            "/swagger-ui/**",
            "/api/utils/status",
            "/api/utils/application-logs",
            "/api/utils/download-tracker",
            "/api/stream/watch/**",
            "/api/stream/download/**",
            "/*", "/db-world/**", "/static/**"
    };

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
    public static String LOG42_FILE_PATH;
    public static String DOWNLOAD_LOG_PATH;
    public static String STREAM_HOME_PATH;
    public static String INTEGRATION_FOLDER_PATH;
    public static String EXTERNAL_STREAM_HOME_PATH;
    public static String EXTERNAL_H_DISK_PATH;
    public static String TORRENT_DOWNLOAD_HOME_PATH;
    public static String HS_COOKIES_PATH;
    public static String YT_DLP;

    @PostConstruct
    public void initConstants() {
        TEMP_DOWNLOAD_PATH = dbWorldPropertiesConfig.getPaths().getTempDownloadPath();
        LOGS_FILE_PATH = dbWorldPropertiesConfig.getPaths().getLogFilePath();
        DOWNLOAD_LOG_PATH = dbWorldPropertiesConfig.getPaths().getDownloadLogPath();
        INTEGRATION_FOLDER_PATH = dbWorldPropertiesConfig.getPaths().getIntegrationFolderPath();
        STREAM_HOME_PATH = dbWorldPropertiesConfig.getPaths().getStreamHomePath();
        EXTERNAL_STREAM_HOME_PATH = dbWorldPropertiesConfig.getPaths().getExternalStreamHomePath();
        TORRENT_DOWNLOAD_HOME_PATH = dbWorldPropertiesConfig.getPaths().getTorrentDownloadPath();
        YT_DLP = dbWorldPropertiesConfig.getPaths().getYtDlp();
        MEDIAINFO = dbWorldPropertiesConfig.getPaths().getMediainfo();
        HS_COOKIES_PATH = dbWorldPropertiesConfig.getPaths().getHsCookiesPath();
        EXTERNAL_STREAM_HOME_PATH = dbWorldPropertiesConfig.getPaths().getExternalStreamHomePath();
        EXTERNAL_H_DISK_PATH = dbWorldPropertiesConfig.getPaths().getExtHDiskPath();
        LOG42_FILE_PATH = dbWorldPropertiesConfig.getPaths().getLog4j2LogPath();
        TMDB_API_KEY = dbWorldPropertiesConfig.getApi_keys().getTmdb();
        createTmdbUrls(dbWorldPropertiesConfig.getApi_keys().getTmdb());
    }

    private void createTmdbUrls(String tmdbApiKey){
        TMDB_MOVIE_DETAILS_URL = "https://api.themoviedb.org/3/movie/" + REPLACE_ID_STRING + "?api_key=" + tmdbApiKey + "&append_to_response=videos,images,credits";
        TMDB_SERIES_DETAILS_URL = "https://api.themoviedb.org/3/tv/" + REPLACE_ID_STRING + "?api_key=" + tmdbApiKey + "&append_to_response=videos,images,credits";
        TMDB_MOVIE_PROVIDER_URL = "https://api.themoviedb.org/3/movie/" + REPLACE_ID_STRING + "/watch/providers?api_key=" + tmdbApiKey;
        TMDB_SERIES_PROVIDER_URL = "https://api.themoviedb.org/3/tv/" + REPLACE_ID_STRING + "/watch/providers?api_key=" + tmdbApiKey;
        TMDB_SEARCH_MOVIE_PROVIDER_URL = "https://api.themoviedb.org/3/search/movie?api_key=" + tmdbApiKey + "&query=" + REPLACE_QUERY_STRING + "&year=" + REPLACE_YEAR_STRING; //&year=YEAR
        TMDB_SEARCH_SERIES_PROVIDER_URL = "https://api.themoviedb.org/3/search/tv?api_key=" + tmdbApiKey + "&query=" + REPLACE_QUERY_STRING + "&year=" + REPLACE_YEAR_STRING;
    }

}
