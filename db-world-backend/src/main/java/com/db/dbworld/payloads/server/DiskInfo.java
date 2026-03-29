package com.db.dbworld.payloads.server;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.List;

/** @deprecated Use {@link com.db.dbworld.app.system.info.dto.DiskInfo} instead. */
@Deprecated(forRemoval = true)
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
