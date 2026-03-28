package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class EpisodeTmdbResponse {

    private Long id;

    private int episode_number;

    private String name;

    private String overview;

    private String air_date;

    private int runtime;

    private double vote_average;

    private int vote_count;

    private String still_path;

    private Integer season_number;

}