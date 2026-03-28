package com.db.dbworld.app.cinema.tmdb.enums;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum VideoSite {

    YOUTUBE,
    VIMEO,
    DAILYMOTION,

    APPLE,
    ITUNES,
    GOOGLE_PLAY,

    FACEBOOK,
    TWITTER,
    INSTAGRAM,

    YAHOO,
    MICROSOFT,
    IGN,
    HULU,
    NETFLIX,

    UNKNOWN;

    @JsonCreator
    public static VideoSite from(String value) {

        if (value == null || value.isBlank()) {
            return UNKNOWN;
        }

        String normalized = value
                .trim()
                .toUpperCase()
                .replace(" ", "_")
                .replace("-", "_");

        try {
            return VideoSite.valueOf(normalized);
        } catch (IllegalArgumentException ex) {
            return UNKNOWN;
        }
    }
}