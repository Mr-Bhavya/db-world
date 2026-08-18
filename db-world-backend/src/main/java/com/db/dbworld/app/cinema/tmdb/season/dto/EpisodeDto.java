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

    /**
     * The entity and mapper have carried this all along; the DTO simply never
     * exposed it. Consumers that need an episode's season — the "last/next
     * episode to air" cards, which receive a bare EpisodeDto with no parent —
     * were falling back to scanning every season's episode list to find it, or
     * rendering S{undefined}.
     */
    private Integer seasonNumber;

    private String name;

    private String overview;

    private String airDate;

    private int runtime;

    private double voteAverage;

    private int voteCount;

    private String stillPath;

}