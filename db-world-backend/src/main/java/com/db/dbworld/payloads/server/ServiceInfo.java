package com.db.dbworld.payloads.server;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceInfo {
    private String name;
    private String displayName;
    private String description;
    private String status;
    private String startType;
    private String executablePath;
    private String pid;
    private String user;
    private String group;
    private Long memoryUsage;
}
