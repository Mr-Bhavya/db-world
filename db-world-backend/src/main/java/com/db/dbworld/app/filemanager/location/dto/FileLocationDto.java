package com.db.dbworld.app.filemanager.location.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class FileLocationDto {
    private String id;
    private String label;
    private String absolutePath;
    private boolean enabled;
    private int sortOrder;
    private boolean available; // available = path exists & readable now
    private Instant createdAt;
}
