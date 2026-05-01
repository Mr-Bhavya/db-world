package com.db.dbworld.payloads.server.os.windows;

import com.db.dbworld.payloads.server.BaseServerInfo;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.SuperBuilder;
import java.util.List;

@Data
@SuperBuilder
@EqualsAndHashCode(callSuper = true)
public class WindowsServerInfo extends BaseServerInfo {
    private WindowsInfo windowsInfo;
    private WindowsGpuInfo gpu;
    private WindowsBatteryInfo battery;
    private WindowsFeatures windowsFeatures;
    private List<EventLogEntry> eventLog;
    private WindowsSecurityInfo security;
    private WindowsHardwareDetails hardwareDetails;
}

