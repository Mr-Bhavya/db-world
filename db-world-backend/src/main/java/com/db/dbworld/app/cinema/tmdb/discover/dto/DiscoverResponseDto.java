package com.db.dbworld.app.cinema.tmdb.discover.dto;

import com.db.dbworld.cinema.tmdb.dto.TmdbDto;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class DiscoverResponseDto {

    private int page;

    private int total_pages;

    private int total_results;

    private List<TmdbDto> results;

}