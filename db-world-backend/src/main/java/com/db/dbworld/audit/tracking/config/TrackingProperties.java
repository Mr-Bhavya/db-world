package com.db.dbworld.audit.tracking.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Startup-bound tracking paths that stay in YAML (infra, not runtime knobs). */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "dbworld.tracking")
public class TrackingProperties {
    /** nginx CDN access log the shipper tails. */
    private String cdnLogPath = "/app/db_world/logs/nginx/cdn_access.log";
    private String rotatedSuffix = ".1";
}
