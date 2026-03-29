package com.db.dbworld.app.cinema.tmdb.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.dto.MovieTmdbDto;
import com.db.dbworld.app.cinema.tmdb.dto.TvSeriesTmdbDto;
import com.db.dbworld.app.cinema.tmdb.ingestion.TmdbIngestionService;
import com.db.dbworld.app.cinema.tmdb.mapper.MovieTmdbMapper;
import com.db.dbworld.app.cinema.tmdb.mapper.TvSeriesTmdbMapper;
import com.db.dbworld.app.cinema.tmdb.people.dto.PersonDto;
import com.db.dbworld.app.cinema.tmdb.people.mapper.PersonMapper;
import com.db.dbworld.app.cinema.tmdb.search.dto.TmdbSearchItemDto;
import com.db.dbworld.app.cinema.tmdb.search.service.TmdbSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cinema/admin/tmdb")
@RequiredArgsConstructor
public class TmdbController {

    private final TmdbIngestionService ingestionService;
    private final TmdbSearchService tmdbSearchService;

    private final MovieTmdbMapper movieMapper;
    private final TvSeriesTmdbMapper tvMapper;
    private final PersonMapper personMapper;

    /* =========================
       MOVIES
       ========================= */

    @PostMapping("/movies/{tmdbId}")
    public ApiResponse<MovieTmdbDto> ingestMovie(@PathVariable Long tmdbId) {

        return ApiResponse.success(
                movieMapper.toDto(
                        ingestionService.ingestMovie(tmdbId)
                )
        );
    }

    @PostMapping("/movies/bulk")
    public ApiResponse<List<MovieTmdbDto>> ingestMovies(
            @RequestBody List<Long> tmdbIds
    ) {

        return ApiResponse.success(
                ingestionService.ingestMovies(tmdbIds)
                        .stream()
                        .map(movieMapper::toDto)
                        .toList()
        );
    }

    @PutMapping("/movies/{tmdbId}")
    public ApiResponse<MovieTmdbDto> refreshMovie(@PathVariable Long tmdbId) {

        return ApiResponse.success(
                movieMapper.toDto(
                        ingestionService.refreshMovie(tmdbId)
                )
        );
    }

    /* =========================
       TV SERIES
       ========================= */

    @PostMapping("/tv/{tmdbId}")
    public ApiResponse<TvSeriesTmdbDto> ingestTvSeries(@PathVariable Long tmdbId) {

        return ApiResponse.success(
                tvMapper.toDto(
                        ingestionService.ingestTvSeries(tmdbId)
                )
        );
    }

    @PostMapping("/tv/bulk")
    public ApiResponse<List<TvSeriesTmdbDto>> ingestTvSeries(
            @RequestBody List<Long> tmdbIds
    ) {

        return ApiResponse.success(
                ingestionService.ingestTvSeries(tmdbIds)
                        .stream()
                        .map(tvMapper::toDto)
                        .toList()
        );
    }

    @PutMapping("/tv/{tmdbId}")
    public ApiResponse<TvSeriesTmdbDto> refreshTvSeries(@PathVariable Long tmdbId) {

        return ApiResponse.success(
                tvMapper.toDto(
                        ingestionService.refreshTvSeries(tmdbId)
                )
        );
    }

    /* =========================
       PERSON
       ========================= */

    @PostMapping("/persons/{personId}")
    public ApiResponse<PersonDto> ingestPerson(@PathVariable Long personId) {

        return ApiResponse.success(
                personMapper.toDto(
                        ingestionService.ingestPerson(personId)
                )
        );
    }

    @PutMapping("/persons/{personId}")
    public ApiResponse<PersonDto> refreshPerson(@PathVariable Long personId) {

        return ApiResponse.success(
                personMapper.toDto(
                        ingestionService.refreshPerson(personId)
                )
        );
    }

    /* =========================
       SEARCH
       ========================= */

    @GetMapping("/search")
    public ApiResponse<List<TmdbSearchItemDto>> search(
            @RequestParam RecordType type,
            @RequestParam String query,
            @RequestParam(required = false, defaultValue = "en-US") String language,
            @RequestParam(required = false) Integer year
    ) {
        return ApiResponse.success(tmdbSearchService.search(type, query, language, year));
    }

    /* =========================
       DELETE
       ========================= */

    @DeleteMapping("/media/{tmdbId}")
    public ApiResponse<Void> deleteMedia(@PathVariable Long tmdbId) {

        ingestionService.deleteMedia(tmdbId);

        return ApiResponse.success("TMDB media deleted");
    }

    @DeleteMapping("/persons/{personId}")
    public ApiResponse<Void> deletePerson(@PathVariable Long personId) {

        ingestionService.deletePerson(personId);

        return ApiResponse.success("Person deleted");
    }
}