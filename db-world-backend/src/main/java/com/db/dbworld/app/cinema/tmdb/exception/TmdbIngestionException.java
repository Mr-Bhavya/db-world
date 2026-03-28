package com.db.dbworld.app.cinema.tmdb.exception;

public class TmdbIngestionException extends RuntimeException {
    public TmdbIngestionException(String message) {
        super(message);
    }

    public TmdbIngestionException(String message, Throwable cause) {
        super(message, cause);
    }
}

