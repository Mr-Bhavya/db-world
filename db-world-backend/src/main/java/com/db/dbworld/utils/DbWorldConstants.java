package com.db.dbworld.utils;

import org.springframework.beans.factory.annotation.Value;

public class DbWorldConstants {

    public static final String OWNER = "OWNER";
    public static final String ADMIN = "ADMIN";
    public static final String VIEWER = "VIEWER";
    public static final String REPLACE_ID_STRING = "${id}";
    public static final String REPLACE_QUERY_STRING = "${query}";
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
    public static final String KEY_FACTORY_ALGORITHM = "PBKDF2WithHmacSHA256";
    public static final String KEY_SPEC_ALGORITHM = "AES";
    public static final String ENCRYPT_ALGORITHM = "AES/CBC/PKCS5Padding";

    @Value("${tmdb.api.key}")
//    public static String TMDB_API_KEY;
    public static String TMDB_API_KEY = "30061af77dba3722bbe14a2691055544";
    public static final String TMDB_MOVIE_DETAILS_URL = "https://api.themoviedb.org/3/movie/"+REPLACE_ID_STRING+"?api_key="+TMDB_API_KEY+"&append_to_response=videos,images,credits";
    public static final String TMDB_SERIES_DETAILS_URL = "https://api.themoviedb.org/3/tv/"+REPLACE_ID_STRING+"?api_key="+TMDB_API_KEY+"&append_to_response=videos,images,credits";
    public static final String TMDB_MOVIE_PROVIDER_URL = "https://api.themoviedb.org/3/movie/"+REPLACE_ID_STRING+"/watch/providers?api_key="+TMDB_API_KEY;
    public static final String TMDB_SERIES_PROVIDER_URL = "https://api.themoviedb.org/3/tv/"+REPLACE_ID_STRING+"/watch/providers?api_key="+TMDB_API_KEY;
    public static final String TMDB_SEARCH_MOVIE_PROVIDER_URL = "https://api.themoviedb.org/3/search/movie?api_key="+TMDB_API_KEY+"&query="+ REPLACE_QUERY_STRING; //&year=YEAR
    public static final String TMDB_SEARCH_SERIES_PROVIDER_URL = "https://api.themoviedb.org/3/search/movie?api_key="+TMDB_API_KEY+"&query="+ REPLACE_QUERY_STRING;
    public static final String TEMP_DOWNLOAD_PATH = "./Download/";
    public static final String LOGS_FILE_PATH = "./logs/dbworld.log";
    public static final String STREAM_HOME_PATH = "D:/Bhavya/Videos";
    public static final String EXTERNAL_STREAM_HOME_PATH = "F:/Movies";
    public static final String TORRENT_DOWNLOAD_HOME_PATH = "D:/Bhavya/Videos/Torrent Download";
    public static final String HS_COOKIES_PATH = "D:\\Bhavya\\StartUp_Scripts\\Deployed\\cookies\\HS_COOKIES.txt";
    public static final String YTDLP_EXE_PATH = "C:/YTDLP/yt-dlp.exe";
    public static final String YTDLP_COOKIES_CMD = "--cookies";
    public static final String HOTSTAR_COM = "hotstar.com";
    public static final String ALL_AUTHORIZE = "hasAuthority('"+OWNER+"')" + "||" + "hasAuthority('"+ADMIN+"')" + "||" + "hasAuthority('"+VIEWER+"')";
    public static final String OWNER_AUTHORIZE = "hasAuthority('"+OWNER+"')";
    public static final String OWNER_ADMIN_AUTHORIZE = "hasAuthority('"+OWNER+"')" + "||" + "hasAuthority('"+ADMIN+"')";
    public static final String[] AUTHENTICATED_APIS = new String[]{
            "/api/user/**",
            "/api/cinema/**",
            "/api/role/**",
            "/api/stream/**",
            "/userAppDataEntities",
            "/dBCinemaRecordsEntities",
            "/userEntities",
            "/movieTmdbDataEntities",
            "/passwordManagerCredentials",
            "/userRoleEntities",
            "/seriesTmdbDataEntities",
            "/profile"
    };
    public static final String[] PUBLIC_APIS = new String[]{
            "/api/auth/**",
            "/test/**",
            "/dbworld-api-doc.html",
            "/api/dbworld-api-doc/**",
            "/swagger-ui/**",
            "/api/sam",
            "/api/dbworld-api-doc",
            "/api/utils/system-info",
            "/**"
    };

    public static final long[] MovieTmdbIds = new long[] {512195, 410994, 443635, 391274, 125835, 501987, 452447, 634077, 676792, 864403, 500494, 693462, 566143, 353533, 688618, 773303, 505908, 559581, 619297, 72190, 630004, 864873, 567748, 637649, 672741, 375588, 713235, 784572, 799991, 371676, 540468, 607885, 533885, 659674, 449733, 732886, 368006, 656113, 369865, 770578, 443653, 215248, 295590, 553041, 566139, 868642, 767377, 461809, 390437, 609108, 893614, 599925, 873695, 459713, 534530, 672940, 85043, 465642, 535144, 196846, 466550, 547026, 547654, 534985, 592108, 496334, 752961, 883173, 396378, 197999, 653457, 739413, 590575, 500921, 500919, 916740, 774714, 926085, 524434, 990760, 302156, 758323, 567460, 619803};

    public static final long[] SeriesTmdbIds = new long[] {100612,138396,96853,138396,123377,115161,63174,129418,84454,97173,130692,71912,117376,106651,84469,86423,62560,71914,129680,127210,134029,88989,88329,119122,89080,112745,61889,72339,75758,62286,127862,106581,88300,79130,97175,38472,129495,103368,76669,139285,44217,136170,138940,84105,94414,78191,65143,114079,79340,80968,62126,131830,96677,104663,1399,135670,66788,91016,85427,131621,75450,82605,101648,93352,104913,68421,18165,63351,77169,110534,125938,79242,87324,100757,71446,1425,72739,152431,128217,152429,99494,96777,153637,136308,138247,125279,96312,4709,153950,100732,154247,134578,153190,155054,153950,112314,100732,154247,155846,138211,99966,134949,146173,94796,119105,111838,103761,131927,115036,95665,76619,93392,156903,157232,156441,116135,158843,157856,105759,123888,99002,157219,75200,84962,194499,158396,72374,153870,169590,90966,195900,158916,195930,197130,196847,92749,96162,199357,101352,66732,200822,202748,60574,107588,204157,158051,133670,139686,75006,156507,197588,92830,120911,120318,135786,86733,205147,133775,204302,204908,108296,154825,92782,114068,90802,132171,129612,208199,205505,79566,82421,135035,126098,87508,136998,96977,68815,210067,96481,201063,131488,211137,207391,208939,210232,126254,92783,84773,93785,121710,83659,157061,105521,90669,214530,119051,213635,112119,95403,200881,110316,83981,202228,79622,158345,69557,210916,73375,217271,134465,136283,156902,203832,111837,214078,215330,213241,205040,132117,157383,207878,90027,218953,135502,201852,211261,139099,91557,82856,110492,136283,203202,222231,129552,69710,95555,222922,139280,203857,224333,224654,95558,220977,201050,137040,226707,221871,221300,114922,100911,226531,127529,79680,227807,228554,226772,205166,228658,201085,201088,116799,228718,230034,114472,71915,125816,154824,217945,231779,232137,225824,156714,232281,227318,232442,196474,198004,202237,197495,204276,231681,235086,136368,228782,232811,235819,96677,72710,157065,229183,100088,87108,1399,229403,76331,94997,84958,108978,1396,200879,213895,240322,200946,216985,94244,121659,135238,146176,227004,241088,220801,122226,238419};

}
