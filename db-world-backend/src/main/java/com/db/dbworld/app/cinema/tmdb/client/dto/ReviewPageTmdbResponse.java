package com.db.dbworld.app.cinema.tmdb.client.dto;

import com.db.dbworld.app.cinema.tmdb.review.dto.ReviewDto;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class ReviewPageTmdbResponse {

    private Long id;

    private int page;

    private List<ReviewTmdbResponse> results;

    private int total_pages;

    private int total_results;

}