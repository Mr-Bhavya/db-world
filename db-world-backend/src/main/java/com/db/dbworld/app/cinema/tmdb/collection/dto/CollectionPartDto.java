package com.db.dbworld.app.cinema.tmdb.collection.dto;

/**
 * One film in a collection. {@code recordId} is non-null only when the library holds a
 * record for it that the caller may see, which is what lets the UI split the rail into
 * playable entries and ones the user can request.
 */
public record CollectionPartDto(
        Long tmdbId,
        String title,
        String overview,
        String posterPath,
        String backdropPath,
        String releaseDate,
        Double voteAverage,
        Long recordId,
        String recordSlug
) {

    public boolean available() {
        return recordId != null;
    }
}
