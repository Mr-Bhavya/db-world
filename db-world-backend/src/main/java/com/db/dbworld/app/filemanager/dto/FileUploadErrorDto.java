package com.db.dbworld.app.filemanager.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FileUploadErrorDto {
    private String fileName;
    private String error;
}
