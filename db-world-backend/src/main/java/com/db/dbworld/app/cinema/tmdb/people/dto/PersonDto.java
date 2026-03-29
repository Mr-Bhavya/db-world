package com.db.dbworld.app.cinema.tmdb.people.dto;

import com.db.dbworld.app.cinema.tmdb.credits.entity.CreditEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TvSeriesTmdbEntity;
import jakarta.persistence.Column;
import jakarta.persistence.FetchType;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.OneToMany;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
public class PersonDto {

    private Long id;

    private boolean adult;

    private Integer gender;

    private String knownForDepartment;

    private String name;

    private String originalName;

    private double popularity;

    private String profilePath;

    private String imdbId;

    private String homepage;

    private String biography;

    private LocalDate birthday;

    private LocalDate deathday;

    private String placeOfBirth;

}