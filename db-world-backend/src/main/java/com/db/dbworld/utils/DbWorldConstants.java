package com.db.dbworld.utils;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class DbWorldConstants {

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
    public static final String TMDB_API_KEY = "30061af77dba3722bbe14a2691055544";
    public static final String TMDB_MOVIE_DETAILS_URL = "https://api.themoviedb.org/3/movie/" + REPLACE_ID_STRING + "?api_key=" + TMDB_API_KEY + "&append_to_response=videos,images,credits";
    public static final String TMDB_SERIES_DETAILS_URL = "https://api.themoviedb.org/3/tv/" + REPLACE_ID_STRING + "?api_key=" + TMDB_API_KEY + "&append_to_response=videos,images,credits";
    public static final String TMDB_MOVIE_PROVIDER_URL = "https://api.themoviedb.org/3/movie/" + REPLACE_ID_STRING + "/watch/providers?api_key=" + TMDB_API_KEY;
    public static final String TMDB_SERIES_PROVIDER_URL = "https://api.themoviedb.org/3/tv/" + REPLACE_ID_STRING + "/watch/providers?api_key=" + TMDB_API_KEY;
    public static final String TMDB_SEARCH_MOVIE_PROVIDER_URL = "https://api.themoviedb.org/3/search/movie?api_key=" + TMDB_API_KEY + "&query=" + REPLACE_QUERY_STRING + "&year=" + REPLACE_YEAR_STRING; //&year=YEAR
    public static final String TMDB_SEARCH_SERIES_PROVIDER_URL = "https://api.themoviedb.org/3/search/tv?api_key=" + TMDB_API_KEY + "&query=" + REPLACE_QUERY_STRING + "&year=" + REPLACE_YEAR_STRING;
    public static String TEMP_DOWNLOAD_PATH;
    @Value("${dbworld.paths.tempDownloadPath}")
    public void setTempDownloadPath(String tempDownloadPath){
        TEMP_DOWNLOAD_PATH = tempDownloadPath;
    }
    public static String LOGS_FILE_PATH;
    @Value("${dbworld.paths.logFilePath}")
    public void setLogsFilePath(String logsFilePath){
        LOGS_FILE_PATH = logsFilePath;
    }
    public static String STREAM_HOME_PATH;
    @Value("${dbworld.paths.streamHomePath}")
    public void setStreamHomePath(String streamHomePath){
        STREAM_HOME_PATH = streamHomePath;
    }
    public static String EXTERNAL_STREAM_HOME_PATH;
    @Value("${dbworld.paths.externalStreamHomePath}")
    public void setExternalStreamHomePath(String externalStreamHomePath){
        EXTERNAL_STREAM_HOME_PATH = externalStreamHomePath;
    }
    public static String EXTERNAL_H_DISK_PATH;
    @Value("${dbworld.paths.extHDiskPath}")
    public void setExternalHDiskPath(String externalHDiskPath){
        EXTERNAL_H_DISK_PATH = externalHDiskPath;
    }
    public static String TORRENT_DOWNLOAD_HOME_PATH;
    @Value("${dbworld.paths.torrentDownloadPath}")
    public void setTorrentDownloadHomePath(String torrentDownloadPath){
        TORRENT_DOWNLOAD_HOME_PATH = torrentDownloadPath;
    }
    public static String HS_COOKIES_PATH;
    @Value("${dbworld.paths.hsCookiesPath}")
    public void setHsCookiesPath(String hsCookiesPath){
        HS_COOKIES_PATH = hsCookiesPath;
    }
    public static String YTDLP_EXE_PATH;
    @Value("${dbworld.paths.ytdlpPath}")
    public void setYtdlpExePath(String ytdlpPath){
        YTDLP_EXE_PATH = ytdlpPath;
    }
    public static final String YTDLP_COOKIES_CMD = "--cookies";
    public static final String HOTSTAR_COM = "hotstar.com";
    public static final String AUTHENTICATION_EXCEPTION_MESSAGE = "Token is not valid. Please do login again.";
    public static final String ALL_AUTHORIZE = "hasAuthority('" + OWNER + "')" + "||" + "hasAuthority('" + ADMIN + "')" + "||" + "hasAuthority('" + VIEWER + "')";
    public static final String OWNER_AUTHORIZE = "hasAuthority('" + OWNER + "')";
    public static final String OWNER_ADMIN_AUTHORIZE = "hasAuthority('" + OWNER + "')" + "||" + "hasAuthority('" + ADMIN + "')";
    public static final String[] PUBLIC_APIS = new String[]{
            "/api/auth/**",
            "/test/**",
            "/dbworld-api-doc.html",
            "/swagger-ui/**",
            "/api/utils/status",
            "/api/utils/logs",
            "/api/stream/watch/**",
            "/api/stream/download/**",
            "/*", "/db-world/**", "/static/**"
    };


}
