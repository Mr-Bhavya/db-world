package com.db.dbworld.app.cinema.tmdb.review.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class ReviewPageDto {

    private Long id;

    private int page;

    private List<ReviewDto> results;

    private int total_pages;

    private int total_results;

}