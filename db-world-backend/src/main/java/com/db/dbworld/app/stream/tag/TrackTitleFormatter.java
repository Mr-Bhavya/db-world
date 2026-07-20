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
     * Builds a display title for the video track.
     * Format: {@code {Codec} | {Resolution} | {BitDepth} | {HDR} | {Bitrate}}
     * e.g. {@code "HEVC | 2160p | 10-bit | Dolby Vision | 24.5 Mbps"}.
     * Parts with no value are omitted.
     */
    public static String formatVideoTitle(TrackFilter.VideoInfo v) {
        if (v == null) return "";
        List<String> parts = new ArrayList<>();

        String codec = displayVideoCodec(v.codec());
        if (!codec.isBlank()) parts.add(codec);

        String res = MediaTagResolver.resolveResolution(v.width(), v.height());
        if (res != null && !res.isBlank()) parts.add(res);

        if (v.bitDepth() > 0) parts.add(v.bitDepth() + "-bit");

        String hdr = hdrLabel(v);
        if (!hdr.isBlank()) parts.add(hdr);

        if (v.bitRate() > 0) {
            parts.add(String.format(java.util.Locale.ROOT, "%.1f Mbps", v.bitRate() / 1_000_000.0));
        }

        return String.join(" | ", parts);
    }

    /** Maps an ffprobe codec_name to a human label (HEVC, H.264, AV1, …). */
    private static String displayVideoCodec(String codecName) {
        if (codecName == null || codecName.isBlank()) return "";
        return switch (codecName.toLowerCase()) {
            case "hevc", "h265" -> "HEVC";
            case "h264", "avc"  -> "H.264";
            case "av1"          -> "AV1";
            case "vp9"          -> "VP9";
            case "vc1"          -> "VC-1";
            case "mpeg2video"   -> "MPEG-2";
            default             -> codecName.toUpperCase();
        };
    }

    /** Dolby Vision / HDR10 / HLG label from side data + transfer characteristics, "" for SDR. */
    private static String hdrLabel(TrackFilter.VideoInfo v) {
        if (v.dolbyVision()) return "Dolby Vision";
        String ct = v.colorTransfer() == null ? "" : v.colorTransfer().toLowerCase();
        if (ct.equals("smpte2084"))    return "HDR10";
        if (ct.equals("arib-std-b67")) return "HLG";
        return "";
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
