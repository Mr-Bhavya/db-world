package com.db.dbworld.payloads.server;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/** @deprecated Use {@link com.db.dbworld.app.system.info.dto.ServerInfo} instead. */
@Deprecated(forRemoval = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class ServerInfo {
    private String osName;
    private String osVersion;
    private String osArchitecture;
    private String hostname;
    private String manufacturer;
    private String model;
    private String serialNumber;
    private String uptime;
    private String bootTime;
    private String kernelVersion;
    private String distribution;
    private String distributionVersion;
    private String desktopEnvironment;
}
