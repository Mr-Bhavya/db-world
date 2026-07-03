package com.db.dbworld.app.cinema.progress.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

/**
 * One Continue Watching tile: the record plus where to resume and how far along
 * the user is. Completed items (finished movie / last episode) are filtered out
 * by {@code WatchProgressService.getContinueWatching}.
 */
@Value
@Builder
public class ContinueWatchingDto {
    Long    recordId;
    String  title;
    String  type;          // MOVIE | TV_SERIES
    String  posterPath;
    String  backdropPath;

    /** The media file the player should open on click. */
    String  resumeFileId;
    Integer season;        // null for movies
    Integer episode;       // null for movies

    /** Resume position + duration of the resume target (0 duration when unknown, e.g. a fresh next episode). */
    long    positionMs;
    long    durationMs;

    Instant updatedAt;
}
