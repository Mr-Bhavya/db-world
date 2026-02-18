package com.db.dbworld.payloads.server;

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
    private String model;
    private String serial;
    private String type;
}
