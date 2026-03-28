package com.db.dbworld.app.cinema.tmdb.dto;

import com.db.dbworld.cinema.tmdb.people.dto.PersonDto;
import com.db.dbworld.cinema.tmdb.season.dto.EpisodeDto;
import com.db.dbworld.cinema.tmdb.season.dto.SeasonDto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class TvSeriesTmdbDto extends TmdbDto {

    private String firstAirDate;

    private String lastAirDate;

    private boolean inProduction;

    private int numberOfEpisodes;

    private int numberOfSeasons;

    private String type;

    private List<SeasonDto> seasons;

    private List<Integer> episodeRunTimes;

    private EpisodeDto lastEpisodeToAir;

    private EpisodeDto nextEpisodeToAir;

    private List<PersonDto> createdBy;

}