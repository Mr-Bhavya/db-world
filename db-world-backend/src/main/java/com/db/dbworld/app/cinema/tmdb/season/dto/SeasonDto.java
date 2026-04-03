package com.db.dbworld.app.cinema.tmdb.season.dto;

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

    private List<EpisodeDto> episodes;

}
