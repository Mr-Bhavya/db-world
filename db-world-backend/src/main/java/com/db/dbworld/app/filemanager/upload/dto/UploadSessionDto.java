package com.db.dbworld.app.filemanager.upload.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UploadSessionDto {
    private String uploadId;
    private long totalSize;
    private int chunkSize;
    private long receivedBytes;
    private int nextIndex;
    private String status;
}
