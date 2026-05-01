package com.db.dbworld.payloads.server;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.List;

/** @deprecated Use {@link com.db.dbworld.app.system.info.dto.NetworkAdapter} instead. */
@Deprecated(forRemoval = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class NetworkAdapter {
    private String name;
    private String description;
    private String macAddress;
    private String ipAddress;
    private String subnetMask;
    private String status;
    private Long speed;
    private List<String> ipAddresses;
    private Long bytesReceived;
    private Long bytesSent;
    private String duplex;
    // Live speed fields (bytes per second, 1-second delta)
    private Long rxBytesTotal;
    private Long txBytesTotal;
    private Long rxBytesPerSec;
    private Long txBytesPerSec;
    private String rxBytesPerSecFormatted;
    private String txBytesPerSecFormatted;
    private Long rxErrors;
    private Long txErrors;
    private Long rxPackets;
    private Long txPackets;
}
