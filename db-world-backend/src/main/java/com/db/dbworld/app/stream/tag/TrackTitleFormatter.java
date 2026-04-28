package com.db.dbworld.app.stream.tag;

import com.db.dbworld.app.media.enrichment.TrackFilter;

import java.util.ArrayList;
import java.util.List;

/**
 * Builds human-readable title strings for audio and subtitle tracks
 * from ffprobe-sourced {@link TrackFilter.TrackInfo} metadata.
 *
 * Examples:
 * <pre>
 *   Audio:    "Hindi | AC-3 | 5.1 | 640 kbps"
 *   Audio:    "English | DDP | 7.1 | 768 kbps"
 *   Subtitle: "Hindi [Forced]"
 *   Subtitle: "English"
 * </pre>
 *
 * All methods are static — no Spring bean required.
 * Delegates codec and language lookups to {@link MediaTagResolver}.
 */
public final class TrackTitleFormatter {

    private TrackTitleFormatter() {}

    /**
     * Builds a display title for an audio track.
     * Format: {@code {Language} | {Codec} | {Channels} | {Bitrate}}
     * Parts with no value are omitted.
     */
    public static String formatAudioTitle(TrackFilter.TrackInfo info) {
        List<String> parts = new ArrayList<>();

        String langDisplay = info.lang().isBlank()
                ? ""
                : MediaTagResolver.resolveLanguage(info.lang().toLowerCase());
        if (!langDisplay.isBlank() && !"Unknown".equalsIgnoreCase(langDisplay)) {
            parts.add(langDisplay);
        }

        if (!info.codec().isBlank()) {
            parts.add(MediaTagResolver.resolveAudioCodecDisplay(info.codec()));
        }

        String ch = MediaTagResolver.resolveChannelLayout(info.channels(), info.channelLayout());
        if (!ch.isBlank()) {
            parts.add(ch);
        }

        if (info.bitRate() > 0) {
            parts.add((info.bitRate() / 1000) + " kbps");
        }

        return String.join(" | ", parts);
    }

    /**
     * Builds a display title for a subtitle track.
     * Format: {@code {Language}} or {@code {Language} [Forced]}
     */
    public static String formatSubTitle(TrackFilter.TrackInfo info) {
        String langDisplay = info.lang().isBlank()
                ? ""
                : MediaTagResolver.resolveLanguage(info.lang().toLowerCase());
        String base = (langDisplay.isBlank() || "Unknown".equalsIgnoreCase(langDisplay))
                ? (info.lang().isBlank() ? "" : info.lang().toUpperCase())
                : langDisplay;
        return info.forced() ? base + " [Forced]" : base;
    }
}
