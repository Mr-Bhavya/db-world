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
public class NetworkInfo {
    private String hostname;
    private String domain;
    private List<NetworkAdapter> adapters;
    private List<String> dnsServers;
    private List<String> ipAddresses;
    private String defaultGateway;
    private Long bytesReceived;
    private Long bytesSent;
    private Integer adapterCount;

    private String Error;
}
