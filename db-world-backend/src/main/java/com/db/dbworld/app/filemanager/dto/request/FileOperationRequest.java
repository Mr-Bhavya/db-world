package com.db.dbworld.app.filemanager.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class FileOperationRequest {
    @NotBlank private String locationId;
    @NotBlank private String sourcePath;
    @NotBlank private String destinationPath;
}
