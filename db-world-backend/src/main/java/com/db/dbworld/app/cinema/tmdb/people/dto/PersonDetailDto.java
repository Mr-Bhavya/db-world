package com.db.dbworld.app.cinema.tmdb.people.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class PersonDetailDto {
    private Long id;
    private String name;
    private String knownForDepartment;
    private String profilePath;
    private String biography;
    private LocalDate birthday;
    private LocalDate deathday;
    private String placeOfBirth;
    private String homepage;
    private String imdbId;
    private String alsoKnownAs;
    private Integer gender;
    private List<FilmographyItemDto> filmography;
}
