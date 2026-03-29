package com.db.dbworld.app.media.enrichment;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Optional track-selection directives applied during TMDB enrichment.
 *
 * All operations are folded into the SAME single FFmpeg pass as:
 * cover-art embedding, title metadata, and file renaming.
 * Null / default values mean "keep as-is".
 *
 * Example — keep English audio, remove subtitles:
 * <pre>
 *   TrackFilter.builder()
 *       .keepAudioLanguages(List.of("eng"))
 *       .removeAllSubtitles(true)
 *       .build()
 * </pre>
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrackFilter {

    /**
     * ISO 639-2/B language codes to retain (e.g. "eng", "hin", "jpn").
     * Audio tracks whose {@code language} metadata tag is NOT in this list are dropped.
     * {@code null} = keep all audio tracks.
     */
    private List<String> keepAudioLanguages;

    /**
     * Drop all subtitle/text streams.
     * Default: {@code false} (subtitles are kept).
     */
    @Builder.Default
    private boolean removeAllSubtitles = false;

    /**
     * Keep only the first real video stream (stream index 0).
     * This strips any secondary video streams (e.g. angle tracks).
     * Existing embedded cover-art streams are always removed when a new
     * TMDB poster is embedded, regardless of this flag.
     * Default: {@code false}.
     */
    @Builder.Default
    private boolean keepFirstVideoOnly = false;

    /** Returns {@code true} if any filtering is actually requested. */
    public boolean hasAnyFilter() {
        return removeAllSubtitles
                || keepFirstVideoOnly
                || (keepAudioLanguages != null && !keepAudioLanguages.isEmpty());
    }
}
