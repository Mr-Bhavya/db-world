package com.db.dbworld.app.cinema.tmdb.client.dto;

import com.db.dbworld.cinema.tmdb.review.dto.AuthorDetailsDto;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ReviewTmdbResponse {

    private String id;

    private String author;

    private AuthorDetailsTmdbResponse author_details;

    private String content;

    private String url;

    private String created_at;

    private String updated_at;

}