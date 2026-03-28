package com.db.dbworld.app.cinema.tmdb.client.dto;

import com.db.dbworld.cinema.tmdb.dto.TmdbDto;
import com.db.dbworld.cinema.tmdb.people.dto.PersonDto;
import com.db.dbworld.cinema.tmdb.season.dto.EpisodeDto;
import com.db.dbworld.cinema.tmdb.season.dto.SeasonDto;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class TvSeriesTmdbResponse extends TmdbResponse {

    private Long id;

    private String name;

    private String original_name;

    private String first_air_date;

    private String last_air_date;

    private boolean in_production;

    private int number_of_episodes;

    private int number_of_seasons;

    private String type;

    private List<NetworkTmdbResponse> networks;

    private List<SeasonTmdbResponse> seasons;

    private List<Integer> episode_run_time;

    private EpisodeTmdbResponse last_episode_to_air;

    private EpisodeTmdbResponse next_episode_to_air;

    private List<PersonTmdbResponse> created_by;

}