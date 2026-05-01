package com.db.dbworld.app.cinema.tmdb.media.entity;

import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.app.cinema.tmdb.enums.VideoSite;
import com.db.dbworld.app.cinema.tmdb.enums.VideoType;
import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@Entity
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "videos", schema = "new_db_world")
public class VideoEntity {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tmdb_id", nullable = false)
    private TmdbEntity tmdb;

    private String name;

    @Column(name = "stream_key")
    private String key;

    @Enumerated(EnumType.STRING)
    private VideoSite site;

    private int size;

    @Enumerated(EnumType.STRING)
    private VideoType type;

    private boolean official;

    private String publishedAt;

    @Column(name = "language_code")
    private String iso6391;

    @Column(name = "country_code")
    private String iso31661;

}