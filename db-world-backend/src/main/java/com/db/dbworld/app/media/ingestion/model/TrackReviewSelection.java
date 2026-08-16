package com.db.dbworld.app.media.ingestion.model;

import com.db.dbworld.app.media.enrichment.TrackFilter;

import java.util.List;

/**
 * The admin's audio/subtitle choice submitted for a job parked in {@code AWAITING_INPUT}.
 * Language-based, mirroring {@link TrackFilter}.
 *
 * <ul>
 *   <li>{@code keepAudioLanguages} — codes to keep. Empty/null is treated as "keep all audio"
 *       (a media file must retain at least one audio track).</li>
 *   <li>{@code keepSubtitleLanguages} — codes to keep; an empty (non-null) list drops ALL subtitles.
 *       Null also means keep all.</li>
 * </ul>
 */
public record TrackReviewSelection(
        List<String> keepAudioLanguages,
        List<String> keepSubtitleLanguages,
        String defaultAudioLanguage,
        Boolean removeAllSubtitles,
        Boolean noDefaultSubtitle
) {

    /**
     * Convert to the model {@link TrackFilter} applied in the FFmpeg pass. The result is marked
     * {@code explicit} so SmartTrackFilterService honours it verbatim (it won't recompute a smart
     * default even when the choice is "keep everything").
     */
    public TrackFilter toTrackFilter() {
        // Never drop every audio track — an empty audio choice means "keep all".
        List<String> keepAudio = (keepAudioLanguages == null || keepAudioLanguages.isEmpty())
                ? null
                : keepAudioLanguages;

        boolean dropAllSubs = Boolean.TRUE.equals(removeAllSubtitles)
                || (keepSubtitleLanguages != null && keepSubtitleLanguages.isEmpty());

        return TrackFilter.builder()
                .keepAudioLanguages(keepAudio)
                .keepSubtitleLanguages(dropAllSubs ? List.of() : keepSubtitleLanguages)
                .defaultAudioLanguage(defaultAudioLanguage)
                .removeAllSubtitles(dropAllSubs)
                .noDefaultSubtitle(noDefaultSubtitle == null || noDefaultSubtitle)
                .explicit(true)
                .build();
    }
}
