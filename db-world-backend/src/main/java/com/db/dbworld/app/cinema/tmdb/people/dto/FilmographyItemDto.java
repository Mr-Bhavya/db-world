package com.db.dbworld.app.cinema.tmdb.people.dto;

import com.db.dbworld.app.cinema.tmdb.enums.CreditType;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FilmographyItemDto {
    private Long tmdbId;
    private Long recordId;
    private String title;
    private String posterPath;
    private String mediaType;       // "MOVIE" or "TV_SERIES"
    private CreditType creditType;  // CAST or CREW
    private String character;       // cast role
    private String job;             // crew role (e.g. Director)
    private String department;
    private Integer castOrder;
}
