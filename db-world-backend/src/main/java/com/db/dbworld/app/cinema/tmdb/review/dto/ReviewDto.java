package com.db.dbworld.app.cinema.tmdb.review.dto;

import com.db.dbworld.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.cinema.tmdb.review.entity.AuthorDetails;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
public class ReviewDto {

    private String id;   // TMDB review id

    private String author;

    private AuthorDetails authorDetails;

    private String content;

    private String url;

    private Instant createdAt;

    private Instant updatedAt;

}