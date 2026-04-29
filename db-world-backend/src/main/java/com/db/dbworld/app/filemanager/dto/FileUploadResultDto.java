package com.db.dbworld.app.filemanager.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class FileUploadResultDto {
    private List<FileItemDto> uploaded;
    private List<FileUploadErrorDto> errors;
    private int totalRequested;
    private int successCount;
    private int failureCount;
}
