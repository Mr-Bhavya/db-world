package com.db.dbworld.exceptions;

import lombok.Getter;
import lombok.Setter;
import org.springframework.http.HttpStatusCode;

@Getter
@Setter
public class TmdbApiException extends RuntimeException {

    private long tmdbId;
    private HttpStatusCode httpStatusCode;

    public TmdbApiException(long tmdbId, String message, HttpStatusCode httpStatusCode) {
        super(String.format("TMDB ID - %s, Error: %s", tmdbId, message));
        this.tmdbId = tmdbId;
        this.httpStatusCode = httpStatusCode;
    }
}
