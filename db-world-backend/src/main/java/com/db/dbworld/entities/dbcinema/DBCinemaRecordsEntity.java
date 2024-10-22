package com.db.dbworld.entities.dbcinema;

import com.db.dbworld.entities.dbcinema.tmdb.TmdbDataEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.util.ArrayList;
import java.util.Date;

@Getter
@Setter
@Entity
@AllArgsConstructor
@NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
@Table(name = "DB_CINEMA_RECORDS", schema = "db_world")
public class DBCinemaRecordsEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE)
    private Long id;
    private String name;
    private String type;
    private boolean showOnTop;

    @CreatedDate
    private Date creationDate;

    @LastModifiedDate
    private Date lastModifiedDate;

    @OneToOne(fetch = FetchType.EAGER, cascade = CascadeType.ALL)
    @JoinColumn(name = "tmdb", referencedColumnName = "id")
    private TmdbDataEntity tmdb;

    @Transient
    private boolean isWatchListed;

    @Transient
    private boolean isLiked;

//    @OneToOne(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
//    @JoinColumn(name = "tmdb_data", referencedColumnName = "id")
//    private SeriesTmdbDataEntity series_tmdb_data;
//    private T tmdb_data;
//    private ArrayList<String> watchListBy;
//    private ArrayList<String> likedBy;
//    private ArrayList<String> disLikeBy;
//    @DocumentReference
//    private ArrayList<DBCinemaRating> ratings;
//    @DocumentReference
//    private ArrayList<DBCinemaComment> comments;
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
