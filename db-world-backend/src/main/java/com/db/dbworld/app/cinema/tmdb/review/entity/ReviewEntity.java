package com.db.dbworld.app.cinema.tmdb.review.entity;

import com.db.dbworld.cinema.tmdb.entities.TmdbEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "tmdb_reviews", schema = "db_world")
public class ReviewEntity {

    @Id
    private String id;   // TMDB review id

    private String author;

    @Embedded
    private AuthorDetails authorDetails;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String content;

    private String url;

    private Instant createdAt;

    private Instant updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tmdb_id")
    private TmdbEntity tmdb;

}