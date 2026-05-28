package com.db.dbworld.audit.activity.shipper;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "dbworld.log-shipper")
public class LogShipperProperties {

    private boolean enabled = true;

    private String logFilePath = "/var/log/nginx/cdn_access.json";

    private String rotatedSuffix = ".1";

    private long batchTickMs = 5000L;

    private int maxAccumulatorEntries = 10_000;

    private long maxBytesPerTick = 5L * 1024 * 1024;
}
