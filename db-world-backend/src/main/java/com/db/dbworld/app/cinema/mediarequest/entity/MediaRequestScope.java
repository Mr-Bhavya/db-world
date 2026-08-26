package com.db.dbworld.app.cinema.mediarequest.entity;

import com.db.dbworld.core.exception.DbWorldException;
import org.springframework.http.HttpStatus;

/**
 * What part of a title a media request is asking for.
 *
 * <p>A request used to be per-record, which is fine for a movie but nearly useless for a
 * series: "needs files for Breaking Bad" tells an admin nothing when seasons 1-3 are already
 * there. A scope narrows it to a season or a single episode.
 *
 * <p><b>Why {@link #ALL} is {@code -1} and not {@code null}:</b> the scope is part of the
 * request's uniqueness ({@code record_id, kind, season_number, episode_number}) and MySQL
 * treats NULLs in a unique index as distinct — so nullable columns would let the same
 * whole-title request be created any number of times. Season 0 is a real season (Specials),
 * so 0 can't be the sentinel either. The sentinel stays inside the persistence layer: the
 * API exposes {@code null} for "the whole title" via {@link #seasonOrNull()}.
 */
public record MediaRequestScope(int season, int episode) {

    /** Sentinel for "not scoped to a season / episode". */
    public static final int ALL = -1;

    /** The whole title — every season, every episode (and the only valid scope for a movie). */
    public static final MediaRequestScope WHOLE_TITLE = new MediaRequestScope(ALL, ALL);

    /**
     * Normalise a request's optional season/episode into a scope.
     *
     * @throws DbWorldException 400 if an episode is given without a season (there is no such
     *                          thing as "episode 5 of no season in particular")
     */
    public static MediaRequestScope of(Integer season, Integer episode) {
        if (season == null) {
            if (episode != null) {
                throw new DbWorldException(HttpStatus.BAD_REQUEST,
                        "An episode request must also name its season");
            }
            return WHOLE_TITLE;
        }
        if (season < 0) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Season number cannot be negative");
        }
        if (episode == null) {
            return new MediaRequestScope(season, ALL);
        }
        if (episode < 0) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Episode number cannot be negative");
        }
        return new MediaRequestScope(season, episode);
    }

    /** Scope of an existing row, sentinels included. */
    public static MediaRequestScope ofRaw(int season, int episode) {
        return new MediaRequestScope(season, episode);
    }

    /** {@code -1} → {@code null}, for API responses. */
    public static Integer nullIfAll(Integer value) {
        return value == null || value == ALL ? null : value;
    }

    public boolean isWholeTitle() {
        return season == ALL;
    }

    public boolean isSeason() {
        return season != ALL && episode == ALL;
    }

    public boolean isEpisode() {
        return season != ALL && episode != ALL;
    }

    public Integer seasonOrNull() {
        return season == ALL ? null : season;
    }

    public Integer episodeOrNull() {
        return episode == ALL ? null : episode;
    }

    /**
     * Short label for chips, notifications and pushes: {@code All}, {@code Season 2},
     * {@code Specials}, {@code S02E05}, {@code SP05}.
     */
    public String label() {
        if (isWholeTitle()) {
            return "All";
        }
        boolean specials = season == 0;
        if (isSeason()) {
            return specials ? "Specials" : "Season " + season;
        }
        return specials
                ? "SP%02d".formatted(episode)
                : "S%02dE%02d".formatted(season, episode);
    }

    /** {@code "Breaking Bad"} for a whole-title scope, {@code "Breaking Bad · S02E05"} otherwise. */
    public String qualify(String title) {
        String base = title == null ? "" : title;
        return isWholeTitle() ? base : base + " · " + label();
    }
}
