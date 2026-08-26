package com.db.dbworld.app.cinema.tmdb.service;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.client.dto.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface TmdbService {

    Mono<MovieTmdbResponse> fetchMovie(Long tmdbId);

    Mono<TvSeriesTmdbResponse> fetchTvSeries(Long tmdbId);

    Flux<ReviewTmdbResponse> fetchAllMovieReviews(Long movieId);

    Flux<ReviewTmdbResponse> fetchAllTvReviews(Long tvId);

    Mono<SeasonTmdbResponse> fetchSeason(Long tvId, int seasonNumber);

    Mono<ProvidersTmdbResponse> fetchProviders(Long tmdbId, RecordType type);

    /**
     * Videos for one language. Separate from the detail call because TMDB filters the
     * {@code videos} append by request language and offers no way to ask for several at once on
     * these endpoints — so extra languages cost one request each.
     */
    Mono<VideosTmdbResponse> fetchVideos(Long tmdbId, RecordType type, String language);

    Mono<PersonTmdbResponse> fetchPerson(Long personId);

    Flux<Long> fetchAllMovieChanges(String startDate, String endDate);

    Flux<Long> fetchAllTvChanges(String startDate, String endDate);
}