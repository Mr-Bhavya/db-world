package com.db.dbworld.app.media.info.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

import java.util.Map;

/**
 * Lightweight DTO for a single media track.
 *
 * Common fields are promoted to top-level properties.
 * Full raw data is available in `extra` for consumers that need it.
 */
@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TrackDto {

    /** General, Video, Audio, Text */
    private String type;

    private Integer streamOrder;

    // ── General ──────────────────────────────────────────────────────────────
    private String format;
    private Long   fileSize;
    private Long   duration;     // ms
    private Long   overallBitRate;
    private Integer videoCount;
    private Integer audioCount;
    private Integer textCount;

    // ── Video ─────────────────────────────────────────────────────────────────
    private Integer width;
    private Integer height;
    private String  frameRate;
    private Long    bitRate;
    private Integer bitDepth;
    private String  colorSpace;
    private String  hdrFormat;
    private String  hdrFormatCompatibility;

    // ── Audio / Text ──────────────────────────────────────────────────────────
    private String  language;
    private String  title;
    private Integer channels;
    private Long    samplingRate;
    private String  defaultTrack;
    private String  forced;

    // ── Image (embedded cover art / TMDB poster) ──────────────────────────────
    /** MIME type for image tracks: image/jpeg, image/png */
    private String mimeType;
    /**
     * Image origin: "EMBEDDED" (was in file originally) or "TMDB" (added by enrichment).
     */
    private String source;
    /** TMDB poster path (e.g. /abc123.jpg) — set when source = "TMDB". */
    private String tmdbPosterPath;

    /**
     * Full raw JSON from MediaInfo for this track.
     * Named "rawMediaInfo" (not "extra") to avoid confusion with MediaInfo's own
     * nested "extra" sub-object that appears inside this map for codec parameters.
     * Access codec-specific values via rawMediaInfo.get("extra").
     */
    private Map<String, Object> rawMediaInfo;
}
