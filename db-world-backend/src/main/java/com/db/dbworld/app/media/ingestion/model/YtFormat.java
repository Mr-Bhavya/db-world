package com.db.dbworld.app.media.ingestion.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

/**
 * Represents a single yt-dlp format entry returned by the /yt/formats endpoint.
 */
@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class YtFormat {
    private String  formatId;
    private String  ext;
    private String  resolution;   // e.g. "1920x1080" or "audio only"
    private Integer width;
    private Integer height;
    private Long    tbr;          // total bitrate kbps
    private Long    abr;          // audio bitrate kbps
    private Long    vbr;          // video bitrate kbps
    private String  acodec;
    private String  vcodec;
    private String  fps;
    private Long    filesize;     // bytes, may be null
    private String  formatNote;    // e.g. "1080p", "DASH audio"
    private String  dynamicRange;  // "SDR", "HDR10", "HDR10+", "HLG", "DV" — null if unknown
    private String  type;          // "video", "audio", "combined"
}
