package com.db.dbworld.app.system.info.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class DriveInfo {
    private String device;
    private String volumeName;
    private String mountPoint;
    private String fileSystem;
    private Long totalBytes;
    private Long freeBytes;
    private Long usedBytes;
    private String totalFormatted;
    private String freeFormatted;
    private String usedFormatted;
    private String usedPercent;
    private Boolean readOnly;
    private Boolean removable;
    private String model;
    private String vendor;
    private String label;
    private String serial;
    private String type;
}
