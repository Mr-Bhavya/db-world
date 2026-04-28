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
    private Instant createdAt;
    private Instant updatedAt;

    // Extracted from primary video track
    private Integer videoHeight;
    private Integer videoWidth;
    private String  videoCodec;
    private String  hdrFormat;
    private String  frameRate;
    private Long    videoBitRate;

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
