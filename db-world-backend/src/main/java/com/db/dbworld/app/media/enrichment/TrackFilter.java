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
 * Example — keep Hindi + English audio, Hindi subtitle only, Hindi as default:
 * <pre>
 *   TrackFilter.builder()
 *       .keepAudioLanguages(List.of("hin", "eng"))
 *       .keepSubtitleLanguages(List.of("hin"))
 *       .defaultAudioLanguage("hin")
 *       .noDefaultSubtitle(true)
 *       .build()
 * </pre>
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrackFilter {

    /**
     * ISO 639-2/B language codes for audio tracks to retain (e.g. "hin", "eng", "guj").
     * Audio tracks whose {@code language} tag is NOT in this list are dropped.
     * {@code null} = keep all audio tracks.
     */
    private List<String> keepAudioLanguages;

    /**
     * ISO 639-2/B language codes for subtitle/text tracks to retain.
     * {@code null}       = keep all subtitle tracks.
     * Empty {@code List} = remove ALL subtitle tracks.
     */
    private List<String> keepSubtitleLanguages;

    /**
     * Language code of the audio track that should be marked as default
     * (e.g. "hin"). Must be present in {@code keepAudioLanguages} if that
     * list is non-null. {@code null} = use the first kept track as default.
     */
    private String defaultAudioLanguage;

    /**
     * When {@code true}, no subtitle track is set as default (disposition = 0).
     * Recommended default: {@code true}.
     */
    @Builder.Default
    private boolean noDefaultSubtitle = true;

    /**
     * Drop ALL subtitle/text streams (legacy flag; prefer empty keepSubtitleLanguages).
     * Default: {@code false}.
     */
    @Builder.Default
    private boolean removeAllSubtitles = false;

    /**
     * Keep only the first real video stream (stream index 0).
     * Default: {@code false}.
     */
    @Builder.Default
    private boolean keepFirstVideoOnly = false;

    /** Returns {@code true} if any filtering or metadata directive is requested. */
    public boolean hasAnyFilter() {
        return removeAllSubtitles
                || keepFirstVideoOnly
                || defaultAudioLanguage != null
                || (keepAudioLanguages != null && !keepAudioLanguages.isEmpty())
                || keepSubtitleLanguages != null;
    }
}
