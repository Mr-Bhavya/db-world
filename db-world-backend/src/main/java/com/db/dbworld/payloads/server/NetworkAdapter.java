package com.db.dbworld.payloads.server;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.List;

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
}
