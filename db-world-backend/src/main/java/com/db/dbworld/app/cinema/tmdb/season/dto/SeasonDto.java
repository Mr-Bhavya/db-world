package com.db.dbworld.app.cinema.tmdb.season.dto;

import com.db.dbworld.app.cinema.tmdb.entities.TvSeriesTmdbEntity;
import com.db.dbworld.app.cinema.tmdb.season.entity.EpisodeEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.util.List;

@Getter
@Setter
public class SeasonDto {

    private Long id;

    private int seasonNumber;

    private String name;

    private String overview;

    private String posterPath;

    private String airDate;

    private Integer episodeCount;

    private Double voteAverage;

    private TvSeriesTmdbEntity tvShow;

    private List<EpisodeDto> episodes;

}