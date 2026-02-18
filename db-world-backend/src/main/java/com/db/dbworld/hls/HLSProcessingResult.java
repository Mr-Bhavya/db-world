package com.db.dbworld.hls;

import com.db.dbworld.utils.DbWorldConstants;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class HLSProcessingResult {
    private String mediaFileId;
    private String fileName;
    private Long recordId;
    private DbWorldConstants.RECORD_TYE recordType;
    private HLSStatus status;
    private String message;
    private String errorMessage;
    private String errorDetails;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Long processingTime; // milliseconds

    // Video info
    private Integer videoWidth;
    private Integer videoHeight;
    private String videoCodec;
    private Integer audioTrackCount;

    // Output info
    private String outputFolder;
    private String playlistUrl;
    private Integer segmentCount;

    private String hlsContentId;
}
