package com.db.dbworld.app.cinema.tmdb.client;

import com.db.dbworld.app.cinema.tmdb.client.dto.*;
import com.db.dbworld.app.cinema.tmdb.search.dto.SearchResponseDto;
import com.db.dbworld.app.cinema.tmdb.discover.dto.DiscoverResponseDto;
import com.db.dbworld.app.cinema.tmdb.trending.dto.TrendingResponseDto;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;
import reactor.core.publisher.Mono;

@Component
@RequiredArgsConstructor
public class TmdbClient {

    private final WebClient webClient;

    /* =====================================
       GENERIC GET HELPERS
     ===================================== */

    private <T> Mono<T> get(String uri, Class<T> responseType) {

        return webClient.get()
                .uri(uri)
                .retrieve()
                .bodyToMono(responseType);
    }

    private <T> Mono<T> get(String uri, String paramName, Object paramValue, Class<T> responseType) {

        return webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path(uri)
                        .queryParam(paramName, paramValue)
                        .build())
                .retrieve()
                .bodyToMono(responseType);
    }

    /* =====================================
       MOVIE APIs
     ===================================== */

    public Mono<MovieTmdbResponse> getMovie(Long id) {
        return get("/movie/" + id, MovieTmdbResponse.class);
    }

    public Mono<MovieTmdbResponse> getMovieFull(Long id) {

        return webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/movie/{id}")
                        .queryParam("append_to_response", "images,videos,credits")
                        .build(id))
                .retrieve()
                .bodyToMono(MovieTmdbResponse.class);
    }

    public Mono<ImagesTmdbResponse> getMovieImages(Long id) {
        return get("/movie/" + id + "/images", ImagesTmdbResponse.class);
    }

    public Mono<VideosTmdbResponse> getMovieVideos(Long id) {
        return get("/movie/" + id + "/videos", VideosTmdbResponse.class);
    }

    public Mono<CreditsTmdbResponse> getMovieCredits(Long id) {
        return get("/movie/" + id + "/credits", CreditsTmdbResponse.class);
    }

    public Mono<ReviewPageTmdbResponse> getMovieReviews(Long id, int page) {
        return get("/movie/" + id + "/reviews", "page", page, ReviewPageTmdbResponse.class);
    }

    public Mono<ProvidersTmdbResponse> getMovieProviders(Long id) {
        return get("/movie/" + id + "/watch/providers", ProvidersTmdbResponse.class);
    }

    public Mono<TmdbChangeResponse> getMovieChanges(String startDate, String endDate, int page) {

        return webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/movie/changes")
                        .queryParam("start_date", startDate)
                        .queryParam("end_date", endDate)
                        .queryParam("page", page)
                        .build())
                .retrieve()
                .bodyToMono(TmdbChangeResponse.class);
    }

    /* =====================================
       TV APIs
     ===================================== */

    public Mono<TvSeriesTmdbResponse> getTvSeries(Long id) {
        return get("/tv/" + id, TvSeriesTmdbResponse.class);
    }

    public Mono<TvSeriesTmdbResponse> getTvSeriesFull(Long id) {

        return webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/tv/{id}")
                        .queryParam("append_to_response", "images,videos,credits")
                        .build(id))
                .retrieve()
                .bodyToMono(TvSeriesTmdbResponse.class);
    }

    public Mono<ImagesTmdbResponse> getTvImages(Long id) {
        return get("/tv/" + id + "/images", ImagesTmdbResponse.class);
    }

    public Mono<VideosTmdbResponse> getTvVideos(Long id) {
        return get("/tv/" + id + "/videos", VideosTmdbResponse.class);
    }

    public Mono<CreditsTmdbResponse> getTvCredits(Long id) {
        return get("/tv/" + id + "/credits", CreditsTmdbResponse.class);
    }

    public Mono<ReviewPageTmdbResponse> getTvReviews(Long id, int page) {
        return get("/tv/" + id + "/reviews", "page", page, ReviewPageTmdbResponse.class);
    }

    public Mono<ProvidersTmdbResponse> getTvProviders(Long id) {
        return get("/tv/" + id + "/watch/providers", ProvidersTmdbResponse.class);
    }

    public Mono<TmdbChangeResponse> getTvChanges(String startDate, String endDate, int page) {

        return webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/tv/changes")
                        .queryParam("start_date", startDate)
                        .queryParam("end_date", endDate)
                        .queryParam("page", page)
                        .build())
                .retrieve()
                .bodyToMono(TmdbChangeResponse.class);
    }

    /* =====================================
       SEASON & EPISODE
     ===================================== */

    public Mono<SeasonTmdbResponse> getSeason(Long tvId, int seasonNumber) {
        return get("/tv/" + tvId + "/season/" + seasonNumber, SeasonTmdbResponse.class);
    }

    public Mono<EpisodeTmdbResponse> getEpisode(Long tvId, int seasonNumber, int episodeNumber) {
        return get("/tv/" + tvId + "/season/" + seasonNumber + "/episode/" + episodeNumber, EpisodeTmdbResponse.class);
    }

    /* =====================================
       PERSON
     ===================================== */

    public Mono<PersonTmdbResponse> getPerson(Long personId) {
        return get("/person/" + personId, PersonTmdbResponse.class);
    }

    /* =====================================
       SEARCH
     ===================================== */

    public Mono<SearchResponseDto> searchMovie(String query, String language, Integer year) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromPath("/search/movie")
                .queryParam("query", query)
                .queryParam("language", language);
        if (year != null) ub.queryParam("year", year);
        return webClient.get().uri(ub.toUriString()).retrieve().bodyToMono(SearchResponseDto.class);
    }

    public Mono<SearchResponseDto> searchTv(String query, String language, Integer year) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromPath("/search/tv")
                .queryParam("query", query)
                .queryParam("language", language);
        if (year != null) ub.queryParam("first_air_date_year", year);
        return webClient.get().uri(ub.toUriString()).retrieve().bodyToMono(SearchResponseDto.class);
    }

    /* =====================================
       TRENDING
     ===================================== */

    public Mono<TrendingResponseDto> getTrendingMovies() {
        return get("/trending/movie/week", TrendingResponseDto.class);
    }

    public Mono<TrendingResponseDto> getTrendingTv() {
        return get("/trending/tv/week", TrendingResponseDto.class);
    }

    /* =====================================
       POPULAR
     ===================================== */

    public Mono<DiscoverResponseDto> getPopularMovies() {
        return get("/movie/popular", DiscoverResponseDto.class);
    }

    public Mono<DiscoverResponseDto> getPopularTv() {
        return get("/tv/popular", DiscoverResponseDto.class);
    }

    /* =====================================
       DISCOVER
     ===================================== */

    public Mono<DiscoverResponseDto> discoverMovies(int page) {
        return get("/discover/movie", "page", page, DiscoverResponseDto.class);
    }

    public Mono<DiscoverResponseDto> discoverTv(int page) {
        return get("/discover/tv", "page", page, DiscoverResponseDto.class);
    }

}