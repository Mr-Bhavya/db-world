package com.db.dbworld.app.system.info.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.List;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class DiskInfo {
    private List<DriveInfo> drives;
    private Integer driveCount;
    private Long totalSpace;
    private Long freeSpace;
    private Long usedSpace;
    private String totalSpaceFormatted;
    private String freeSpaceFormatted;
    private String usedSpaceFormatted;
    private String error;
}
