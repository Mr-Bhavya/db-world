package com.db.dbworld.payloads.dbcinema;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.Date;

@Getter
@Setter
public class DBCinemaRecordsDto {
    private String recordId;
    private String name;
    private String type;
    private Date lastModifiedTime;
    private long tmdbId;
    private ArrayList<String> watchListBy;
    private ArrayList<String> likedBy;
    private ArrayList<String> disLikeBy;
    private ArrayList<DBCinemaRatingDto> ratings;
    private ArrayList<DBCinemaCommentDto> comments;
    private Object tmdbData;
//    private ArrayList<Stream> streams;

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
