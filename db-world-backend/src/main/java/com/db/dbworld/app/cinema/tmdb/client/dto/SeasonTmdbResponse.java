package com.db.dbworld.app.cinema.tmdb.client.dto;

import com.db.dbworld.app.cinema.tmdb.season.dto.EpisodeDto;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class SeasonTmdbResponse {

    private Long id;

    private int season_number;

    private String name;

    private String overview;

    private String poster_path;

    private String air_date;

    private Integer episode_count;

    private Double vote_average;

    private List<EpisodeTmdbResponse> episodes;

}