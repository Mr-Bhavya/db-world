package com.db.dbworld.app.cinema.tmdb.client;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.exception.TmdbIngestionException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;

/** Only a 404 on the title itself means TMDB deleted it; a missing TV season does not. */
class TmdbNotFoundTest {

    private static WebClientResponseException http(int status, String url) {
        return WebClientResponseException.create(HttpStatusCode.valueOf(status), "x", HttpHeaders.EMPTY,
                new byte[0], null, new MockClientHttpRequest(HttpMethod.GET, URI.create(url)));
    }

    /** What a refresh actually throws: the ingestion layer wraps whatever the zip surfaced. */
    private static Throwable wrapped(Throwable cause) {
        return new TmdbIngestionException("Failed to refresh movie", cause);
    }

    @Test
    void aDetail404IsGone() {
        assertThat(TmdbNotFound.isTitleGone(
                wrapped(http(404, "https://api.tmdb.org/3/movie/550?append_to_response=credits")),
                RecordType.MOVIE, 550)).isTrue();
    }

    @Test
    void theProvidersOrReviews404CanSurfaceFirstAndStillCounts() {
        assertThat(TmdbNotFound.isTitleGone(
                wrapped(http(404, "https://api.themoviedb.org/3/tv/1399/watch/providers")),
                RecordType.TV_SERIES, 1399)).isTrue();
        assertThat(TmdbNotFound.isTitleGone(
                http(404, "https://api.tmdb.org/3/movie/550/reviews?page=1"), RecordType.MOVIE, 550)).isTrue();
    }

    @Test
    void aMissingSeasonIsNotAMissingShow() {
        assertThat(TmdbNotFound.isTitleGone(
                wrapped(http(404, "https://api.tmdb.org/3/tv/1399/season/9")),
                RecordType.TV_SERIES, 1399)).isFalse();
    }

    @Test
    void anotherIdOrTypeDoesNotCount() {
        assertThat(TmdbNotFound.isTitleGone(http(404, "https://api.tmdb.org/3/movie/5550"), RecordType.MOVIE, 550))
                .isFalse();
        assertThat(TmdbNotFound.isTitleGone(http(404, "https://api.tmdb.org/3/tv/550"), RecordType.MOVIE, 550))
                .isFalse();
    }

    @Test
    void otherFailuresDoNotCount() {
        assertThat(TmdbNotFound.isTitleGone(
                wrapped(http(500, "https://api.tmdb.org/3/movie/550")), RecordType.MOVIE, 550)).isFalse();
        assertThat(TmdbNotFound.isTitleGone(
                wrapped(new IllegalStateException("connection reset")), RecordType.MOVIE, 550)).isFalse();
        assertThat(TmdbNotFound.isTitleGone(null, RecordType.MOVIE, 550)).isFalse();
    }
}
