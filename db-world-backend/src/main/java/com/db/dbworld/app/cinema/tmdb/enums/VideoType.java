package com.db.dbworld.app.cinema.tmdb.enums;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum VideoType {

    TRAILER,
    TEASER,
    CLIP,
    FEATURETTE,
    BEHIND_THE_SCENES,
    OPENING_CREDITS,
    RECAP,

    UNKNOWN;

    @JsonCreator
    public static VideoType from(String value) {

        if (value == null || value.isBlank()) {
            return UNKNOWN;
        }

        String normalized = value
                .trim()
                .toUpperCase()
                .replace(" ", "_")
                .replace("-", "_");

        try {
            return VideoType.valueOf(normalized);
        } catch (IllegalArgumentException ex) {
            return UNKNOWN;
        }
    }
}