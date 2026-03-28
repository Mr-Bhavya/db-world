package com.db.dbworld.app.cinema.tmdb.exception;

public class TmdbNotFoundException extends RuntimeException {
    public TmdbNotFoundException(String message) {
        super(message);
    }
}
