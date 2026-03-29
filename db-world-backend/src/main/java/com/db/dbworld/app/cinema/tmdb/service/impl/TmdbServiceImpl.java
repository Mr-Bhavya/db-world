package com.db.dbworld.app.cinema.tmdb.service.impl;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.client.TmdbClient;
import com.db.dbworld.app.cinema.tmdb.client.dto.*;
import com.db.dbworld.app.cinema.tmdb.service.TmdbService;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service("newTmdbServiceImpl")
@RequiredArgsConstructor
public class TmdbServiceImpl implements TmdbService {

    private final TmdbClient tmdbClient;

    /* =====================================
       MOVIE
     ===================================== */

    @Override
    public Mono<MovieTmdbResponse> fetchMovie(Long tmdbId) {
        return tmdbClient.getMovieFull(tmdbId);
    }

    @Override
    public Flux<Long> fetchAllMovieChanges(String startDate, String endDate) {

        return tmdbClient.getMovieChanges(startDate, endDate, 1)
                .flatMapMany(firstPage -> {

                    int totalPages = firstPage.getTotal_pages();

                    return Flux.concat(

                            // page 1
                            Mono.just(firstPage),

                            // remaining pages
                            Flux.range(2, Math.max(totalPages - 1, 0))
                                    .flatMap(page ->
                                            tmdbClient.getMovieChanges(startDate, endDate, page)
                                    )
                    );
                })
                .flatMapIterable(TmdbChangeResponse::getResults)
                .map(TmdbChangeResponse.ChangeItem::getId)
                .distinct(); // 🔥 important (avoid duplicates)
    }

    /* =====================================
       TV SERIES
     ===================================== */

    @Override
    public Mono<TvSeriesTmdbResponse> fetchTvSeries(Long tmdbId) {
        return tmdbClient.getTvSeriesFull(tmdbId);
    }

    @Override
    public Flux<Long> fetchAllTvChanges(String startDate, String endDate) {

        return tmdbClient.getTvChanges(startDate, endDate, 1)
                .flatMapMany(firstPage -> {

                    int totalPages = firstPage.getTotal_pages();

                    return Flux.concat(

                            Mono.just(firstPage),

                            Flux.range(2, Math.max(totalPages - 1, 0))
                                    .flatMap(page ->
                                            tmdbClient.getTvChanges(startDate, endDate, page)
                                    )
                    );
                })
                .flatMapIterable(TmdbChangeResponse::getResults)
                .map(TmdbChangeResponse.ChangeItem::getId)
                .distinct();
    }

    /* =====================================
       MOVIE REVIEWS
     ===================================== */

    @Override
    public Flux<ReviewPageTmdbResponse> fetchAllMovieReviews(Long movieId) {

        return tmdbClient.getMovieReviews(movieId, 1)
                .flatMapMany(firstPage -> {

                    int totalPages = firstPage.getTotal_pages();

                    return Flux.concat(

                            Mono.just(firstPage),

                            Flux.range(2, Math.max(totalPages - 1, 0))
                                    .flatMap(page ->
                                            tmdbClient.getMovieReviews(movieId, page))
                    );
                });
    }

    /* =====================================
       TV REVIEWS
     ===================================== */

    @Override
    public Flux<ReviewPageTmdbResponse> fetchAllTvReviews(Long tvId) {

        return tmdbClient.getTvReviews(tvId, 1)
                .flatMapMany(firstPage -> {

                    int totalPages = firstPage.getTotal_pages();

                    return Flux.concat(

                            Mono.just(firstPage),

                            Flux.range(2, Math.max(totalPages - 1, 0))
                                    .flatMap(page ->
                                            tmdbClient.getTvReviews(tvId, page))
                    );
                });
    }

    /* =====================================
       SEASON
     ===================================== */

    @Override
    public Mono<SeasonTmdbResponse> fetchSeason(Long tvId, int seasonNumber) {
        return tmdbClient.getSeason(tvId, seasonNumber);
    }

    /* =====================================
       PROVIDERS
     ===================================== */

    @Override
    public Mono<ProvidersTmdbResponse> fetchProviders(Long tmdbId, RecordType type) {

        if (type == RecordType.MOVIE) {
            return tmdbClient.getMovieProviders(tmdbId);
        }

        return tmdbClient.getTvProviders(tmdbId);
    }

    /* =====================================
       PERSON
     ===================================== */

    @Override
    public Mono<PersonTmdbResponse> fetchPerson(Long personId) {

        return tmdbClient.getPerson(personId);
    }

}