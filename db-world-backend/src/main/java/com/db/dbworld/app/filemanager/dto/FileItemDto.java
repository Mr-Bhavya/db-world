package com.db.dbworld.app.filemanager.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class FileItemDto {
    private String name;
    private String path;
    private boolean directory;
    private long sizeBytes;
    private String formattedSize;
    private String extension;
    private String mimeType;
    private LocalDateTime lastModified;
    private LocalDateTime createdAt;
    private int childCount;
    private boolean readable;
    private boolean writable;
    private String locationId;
}
