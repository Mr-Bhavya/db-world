package com.db.dbworld.app.cinema.catalog.dto;

import com.db.dbworld.app.cinema.enums.RecordType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Lightweight DTO returned by the search API.
 * Contains only what the search UI needs (poster, title, year, rating)
 * — much smaller than the full RecordDto.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SearchRecordDto {

    private Long id;

    private String title;

    private RecordType type;          // MOVIE / TV_SERIES

    private Long tmdbId;

    private String posterPath;        // TMDB poster path (e.g. /abc.jpg)

    private double voteAverage;

    private LocalDate releaseDate;    // COALESCE(release_date, first_air_date)

    private String overview;
}
