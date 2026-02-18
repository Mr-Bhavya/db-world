package com.db.dbworld.hls;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class HLSGenerationResult {
    private String sourceFile;
    private String mediaInfoId;
    private String resolutionFolder;
    private String outputFolder;
    private HLSStatus status;
    private String message;
    private String errorMessage;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Long duration; // in milliseconds
    private Integer segmentCount;
}
