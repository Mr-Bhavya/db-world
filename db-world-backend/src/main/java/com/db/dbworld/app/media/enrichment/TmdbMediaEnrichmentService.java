package com.db.dbworld.app.media.enrichment;

import java.nio.file.Path;

/**
 * Enriches a downloaded media file with TMDB metadata in a SINGLE FFmpeg pass.
 *
 * The single pass covers:
 *  1. Cover art   — downloads the TMDB poster/still and embeds it as an attached picture.
 *  2. Metadata    — sets the FFmpeg {@code title} tag (episode name or movie title).
 *  3. Renaming    — TV episodes are renamed to {@code {Title}.S{SS}E{EE}.{EpisodeName}.{ext}};
 *                   movies keep their name (FFmpeg output file carries the final name).
 *  4. Track filter (optional) — audio language selection, subtitle removal, and
 *                   first-video-only are all applied in the same FFmpeg invocation.
 *
 * If {@code recordId} is {@code null} enrichment is skipped and the input path is returned.
 */
public interface TmdbMediaEnrichmentService {

    /**
     * Full enrichment with optional track filtering.
     *
     * @param inputFile   path to the final media file (already in integration dir)
     * @param recordId    RecordEntity.id; {@code null} = skip enrichment
     * @param season      season number (1-based); {@code null} for movies
     * @param episode     episode number (1-based); {@code null} for movies
     * @param trackFilter optional track selection rules applied in the same FFmpeg pass;
     *                    {@code null} = keep all tracks
     * @param jobId       ingestion job ID used for logging
     * @return path to the enriched (and possibly renamed) output file
     */
    Path enrich(Path inputFile, Long recordId, Integer season, Integer episode,
                TrackFilter trackFilter, String jobId);

    /**
     * Backward-compatible overload — no track filtering.
     */
    default Path enrich(Path inputFile, Long recordId, Integer season, Integer episode,
                        String jobId) {
        return enrich(inputFile, recordId, season, episode, null, jobId);
    }
}
