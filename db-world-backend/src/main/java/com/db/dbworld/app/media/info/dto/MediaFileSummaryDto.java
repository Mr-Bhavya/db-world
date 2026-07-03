package com.db.dbworld.app.media.info.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MediaFileSummaryDto {

    private String  id;
    private Long    recordId;
    private String  fileName;
    private String  filePath;
    private Long    fileSize;
    private String  mimeType;
    private String  ingestionJobId;
    private Integer tmdbSeasonNumber;
    private Integer tmdbEpisodeNumber;
    private Instant createdAt;
    private Instant updatedAt;

    // Extracted from primary video track
    private Integer videoHeight;
    private Integer videoWidth;
    private String  videoCodec;
    private String  hdrFormat;
    private String  frameRate;
    private Long    videoBitRate;

    // Derived resolution — display (true) pixels + standard tier. For anamorphic
    // content displayWidth differs from the stored videoWidth (e.g. 1620 -> 1920).
    private Integer displayWidth;
    private Integer displayHeight;
    private String  resolutionLabel;   // "4K" | "1080p" | "720p" | …
    private String  displayAspectRatio;
    private Boolean anamorphic;

    // Whether a scrub-preview storyboard sprite has been generated for this file.
    private Boolean hasStoryboard;

    // Extracted from general track
    private Long    duration;
    private Integer videoCount;
    private Integer audioCount;
    private Integer textCount;

    // Extracted from primary audio track
    private String  audioFormat;
    private Integer audioChannels;
    private String  audioLanguage;
}
