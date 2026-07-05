package com.db.dbworld.audit.tracking.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "dbworld.tracking")
public class TrackingProperties {

    /** Master flag — gates all live tracking writes. */
    private boolean enabled = true;

    /** nginx CDN access log the shipper tails (Plan 1B). */
    private String cdnLogPath = "/app/db_world/logs/nginx/cdn_access.log";
    private String rotatedSuffix = ".1";
    private long   batchTickMs = 5000L;
    private long   maxBytesPerTick = 5L * 1024 * 1024;
    private int    maxAccumulatorEntries = 10_000;

    /** Staleness sweeper (Plan 1B). */
    private int  streamTimeoutMin = 15;
    private int  downloadTimeoutMin = 30;
    private long sweeperTickMs = 60_000L;

    /** Retention (Plan 1B). */
    private int eventRetentionDays = 90;

    /** Collapse prefix-chain searches typed within this window (Plan 2). */
    private int searchPrefixCollapseSec = 30;
}
