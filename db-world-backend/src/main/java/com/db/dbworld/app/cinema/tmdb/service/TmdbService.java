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

    Mono<PersonTmdbResponse> fetchPerson(Long personId);

    Flux<Long> fetchAllMovieChanges(String startDate, String endDate);

    Flux<Long> fetchAllTvChanges(String startDate, String endDate);
}