package com.db.dbworld.app.system.info.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class ProcessInfo {
    private String name;
    private Integer pid;
    private Integer ppid;
    private String user;
    private Double cpuUsage;
    private Long memoryBytes;
    private String memoryFormatted;
    private Double memoryPercent;
    private String state;
    private String commandLine;
    private Long startTime;
    private String startTimeFormatted;
    private String session;
    private Integer priority;
    private Integer threads;
    private Long residentMemory;
    private Long virtualMemory;
}
