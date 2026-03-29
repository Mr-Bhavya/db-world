package com.db.dbworld.app.cinema.tmdb.search.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class SearchResponseDto {

    private int page;

    private int total_pages;

    private int total_results;

    private List<TmdbSearchItemDto> results;

}