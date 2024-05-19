package com.db.dbworld.entities.dbcinema;

import lombok.Getter;
import lombok.Setter;
import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.DocumentReference;

import java.util.ArrayList;

@Getter
@Setter
@Document("DB_CINEMA_RECORDS")
public class DBCinemaRecordsEntity {
    @Id
    private ObjectId recordId;
    private String name;
    private String type;
//    private Date lastModifiedTime;
    @Indexed(unique = true)
    private long tmdbId;
    private ArrayList<String> watchListBy;
    private ArrayList<String> likedBy;
    private ArrayList<String> disLikeBy;
    @DocumentReference
    private ArrayList<DBCinemaRating> ratings;
    @DocumentReference
    private ArrayList<DBCinemaComment> comments;
//    @DocumentReference
//    private MovieTMDBDataEntity movieTMDBData;
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
