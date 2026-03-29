package com.db.dbworld.app.cinema.tmdb.season.dto;

import com.db.dbworld.app.cinema.tmdb.season.entity.SeasonEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class EpisodeDto {

    private Long id;

    private int episodeNumber;

    private String name;

    private String overview;

    private String airDate;

    private int runtime;

    private double voteAverage;

    private int voteCount;

    private String stillPath;

}