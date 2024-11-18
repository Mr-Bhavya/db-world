package com.db.dbworld.payloads.dbcinema;

import com.db.dbworld.payloads.dbcinema.tmdb.MovieTmdbDataDto;
import com.db.dbworld.payloads.dbcinema.tmdb.SeriesTmdbDataDto;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.Date;

@Getter
@Setter
public class DBCinemaRecordsDto {
    private Long recordId;
    private String name;
    private String type;
    private Date lastModifiedTime;
    private long tmdbId;
    private boolean showOnTop;
    private MovieTmdbDataDto movieTmdb;
    private SeriesTmdbDataDto seriesTmdb;
    private boolean isLiked;
    private boolean isWatched;
    private boolean isWatchListed;

    private static class Stream{
        private ArrayList<Format> formats;
        private static class Format{
            private String id;
            private String width;
            private String height;
            private String dynamic_range;
            private String url;
        }
    }

}
