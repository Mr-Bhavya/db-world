package com.db.dbworld.app.cinema.catalog.dto;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.providers.dto.TmdbProviderDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SearchRecordDto {

    private Long id;

    private String title;

    private RecordType type; // MOVIE / TV

    private Long tmdbId;

    private List<String> genres;

    // Posters
    private String posterPath;          // preferred poster (usually with title)
    private String posterPathClean;     // poster without text

    // Backdrops
    private String backdropPath;        // preferred backdrop (clean)
    private String backdropPathText;    // backdrop with title/logo

    private double voteAverage;

    private double popularity;

    private LocalDate releaseDate;

    // Hover preview
    private String overview;

    // Hover trailer
    private String previewVideoUrl;

    // Streaming providers
    private List<TmdbProviderDto> providers;
}