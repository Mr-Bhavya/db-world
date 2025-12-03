package com.db.dbworld.services.aria2.model;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DownloadMonitoringRequest {
    private String gid;
    private String mirrorId;
    private Long startTime;
}