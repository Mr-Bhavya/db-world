package com.db.dbworld.app.cinema.catalog.dto;

import java.util.List;

/**
 * What the library actually holds for a record — PUBLIC, unlike the files themselves.
 *
 * <p><b>Why this exists separately from media-info.</b>
 * {@code /api/stream/media-info/{id}} answered two different questions in one
 * authenticated response: "do we have this?" and "what exactly are the files?". Only the
 * second is sensitive. Fusing them meant a signed-out visitor could not be told whether
 * a title was available, so the record page inferred "no files" from an empty response
 * and offered to REQUEST a title that was sitting in the library.
 *
 * <p>Availability discloses nothing new: the browse rails already advertise publicly
 * which titles exist, and DRAFT records are excluded before this is ever built. File
 * detail — paths, sizes, codecs, audio and subtitle tracks — stays behind
 * authentication where it belongs.
 *
 * <p>Rides along on {@link RecordDto}, which the record page already fetches, so this
 * costs no extra request.
 *
 * @param available     whether anything at all is playable for this record
 * @param episodesHave  distinct episodes held; null for a movie
 * @param episodesTotal episodes TMDB says exist; null for a movie
 * @param seasons       per-season rollup, ordered by season number; empty for a movie
 */
public record RecordAvailabilityDto(
        boolean available,
        Integer episodesHave,
        Integer episodesTotal,
        List<SeasonAvailability> seasons) {

    /**
     * One season's holdings.
     *
     * <p>{@code have} counts DISTINCT episodes, not files: a single episode commonly has
     * several quality variants, and counting files would report "14 of 12".
     *
     * @param season the TMDB season number; 0 is Specials
     */
    public record SeasonAvailability(int season, int have, int total) {

        /** True when every episode TMDB lists for this season is held. */
        public boolean complete() {
            return total > 0 && have >= total;
        }
    }

    /** A movie, or anything with no episode structure. */
    public static RecordAvailabilityDto forMovie(boolean available) {
        return new RecordAvailabilityDto(available, null, null, List.of());
    }
}
