package com.db.dbworld.app.cinema.tmdb.client;

import com.db.dbworld.app.cinema.tmdb.client.dto.*;
import com.db.dbworld.app.cinema.tmdb.discover.dto.DiscoverResponseDto;
import com.db.dbworld.app.cinema.tmdb.search.dto.SearchResponseDto;
import com.db.dbworld.app.cinema.tmdb.trending.dto.TrendingResponseDto;

import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.util.UriBuilder;
import reactor.core.publisher.Mono;

import java.util.function.Consumer;

@Log4j2
@Component
public class TmdbClient {

    private static final String APPEND_FULL_DETAILS = "images,videos,credits";

    private final WebClient webClient;

    public TmdbClient(@Qualifier("tmdbWebClient") WebClient webClient) {
        this.webClient = webClient;
    }

    /**
     * Logs TMDB HTTP errors with status and path.
     * The bearer token is safe because it is configured as a default header
     * in WebClient config and is never part of the URI.
     */
    private <T> Mono<T> logHttpFailure(String path, Mono<T> mono) {
        return mono.doOnError(WebClientResponseException.class, e ->
                log.warn(
                        "TMDB HTTP failure; status={} path={} message={}",
                        statusCode(e),
                        path,
                        e.getMessage()
                )
        );
    }

    private static String statusCode(WebClientResponseException e) {
        var status = e.getStatusCode();
        return String.valueOf(status.value());
    }

    /* =====================================
       GENERIC GET HELPERS
     ===================================== */

    private <T> Mono<T> get(String path, Class<T> responseType) {
        return get(path, responseType, null);
    }

    private <T> Mono<T> get(String path, Class<T> responseType, Consumer<UriBuilder> queryParams) {
        return logHttpFailure(path, webClient.get()
                .uri(uriBuilder -> {
                    var builder = uriBuilder.path(path);

                    if (queryParams != null) {
                        queryParams.accept(builder);
                    }

                    return builder.build();
                })
                .retrieve()
                .bodyToMono(responseType));
    }

    private static void addIfPresent(UriBuilder builder, String name, Object value) {
        if (value != null) {
            builder.queryParam(name, value);
        }
    }

    /* =====================================
       MOVIE APIs
     ===================================== */

    public Mono<MovieTmdbResponse> getMovie(Long id) {
        return get("/movie/" + id, MovieTmdbResponse.class);
    }

    public Mono<MovieTmdbResponse> getMovieFull(Long id) {
        return get("/movie/" + id, MovieTmdbResponse.class,
                builder -> builder.queryParam("append_to_response", APPEND_FULL_DETAILS));
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
        return get("/movie/" + id + "/reviews", ReviewPageTmdbResponse.class,
                builder -> builder.queryParam("page", page));
    }

    public Mono<ProvidersTmdbResponse> getMovieProviders(Long id) {
        return get("/movie/" + id + "/watch/providers", ProvidersTmdbResponse.class);
    }

    public Mono<TmdbChangeResponse> getMovieChanges(String startDate, String endDate, int page) {
        return get("/movie/changes", TmdbChangeResponse.class, builder -> {
            addIfPresent(builder, "start_date", startDate);
            addIfPresent(builder, "end_date", endDate);
            builder.queryParam("page", page);
        });
    }

    /* =====================================
       TV APIs
     ===================================== */

    public Mono<TvSeriesTmdbResponse> getTvSeries(Long id) {
        return get("/tv/" + id, TvSeriesTmdbResponse.class);
    }

    public Mono<TvSeriesTmdbResponse> getTvSeriesFull(Long id) {
        return get("/tv/" + id, TvSeriesTmdbResponse.class,
                builder -> builder.queryParam("append_to_response", APPEND_FULL_DETAILS));
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
        return get("/tv/" + id + "/reviews", ReviewPageTmdbResponse.class,
                builder -> builder.queryParam("page", page));
    }

    public Mono<ProvidersTmdbResponse> getTvProviders(Long id) {
        return get("/tv/" + id + "/watch/providers", ProvidersTmdbResponse.class);
    }

    public Mono<TmdbChangeResponse> getTvChanges(String startDate, String endDate, int page) {
        return get("/tv/changes", TmdbChangeResponse.class, builder -> {
            addIfPresent(builder, "start_date", startDate);
            addIfPresent(builder, "end_date", endDate);
            builder.queryParam("page", page);
        });
    }

    /* =====================================
       SEASON & EPISODE
     ===================================== */

    public Mono<SeasonTmdbResponse> getSeason(Long tvId, int seasonNumber) {
        return get("/tv/" + tvId + "/season/" + seasonNumber, SeasonTmdbResponse.class);
    }

    public Mono<EpisodeTmdbResponse> getEpisode(Long tvId, int seasonNumber, int episodeNumber) {
        return get(
                "/tv/" + tvId + "/season/" + seasonNumber + "/episode/" + episodeNumber,
                EpisodeTmdbResponse.class
        );
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
        return get("/search/movie", SearchResponseDto.class, builder -> {
            builder.queryParam("query", query);
            addIfPresent(builder, "language", language);
            addIfPresent(builder, "year", year);
        });
    }

    public Mono<SearchResponseDto> searchTv(String query, String language, Integer year) {
        return get("/search/tv", SearchResponseDto.class, builder -> {
            builder.queryParam("query", query);
            addIfPresent(builder, "language", language);
            addIfPresent(builder, "first_air_date_year", year);
        });
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
        return get("/discover/movie", DiscoverResponseDto.class,
                builder -> builder.queryParam("page", page));
    }

    public Mono<DiscoverResponseDto> discoverTv(int page) {
        return get("/discover/tv", DiscoverResponseDto.class,
                builder -> builder.queryParam("page", page));
    }
}