package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Getter;
import lombok.Setter;

/**
 * One country's TV content rating, e.g. {@code iso_3166_1=IN, rating="U/A 13+"} or
 * {@code iso_3166_1=US, rating="TV-14"}. As with movies the rating can come back blank.
 */
@Getter
@Setter
public class ContentRatingResultTmdbResponse {

    private String iso_3166_1;

    private String rating;

}
