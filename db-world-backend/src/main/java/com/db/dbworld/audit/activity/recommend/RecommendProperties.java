package com.db.dbworld.audit.activity.recommend;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.NestedConfigurationProperty;
import org.springframework.context.annotation.Configuration;

/** Configuration knobs for the recommendation rails. */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "dbworld.recommend")
public class RecommendProperties {

    @NestedConfigurationProperty
    private Genre   genre   = new Genre();

    @NestedConfigurationProperty
    private Rewatch rewatch = new Rewatch();

    @Getter @Setter
    public static class Genre {
        private boolean enabled = true;
        /** Number of top genres surveyed when picking the rail's genre. */
        private int topN = 3;
        /** Minimum engaged records before the rail is shown (cold-start guard). */
        private int minEngagedRecords = 3;
        /** completion_percent threshold (0-100) that counts a record as engaged. */
        private int completionThreshold = 70;
        /** Per-user cache TTL for the picked genre. */
        private int cacheTtlMin = 60;
    }

    @Getter @Setter
    public static class Rewatch {
        private boolean enabled = true;
        /** Hourly by default. */
        private String refreshCron = "0 0 * * * *";
        /** Lookback window. */
        private int windowDays = 7;
        /** Minimum (download_count + stream_count) sum for inclusion. */
        private int minScore = 3;
        /** Max records cached for the rail. */
        private int topN = 30;
    }
}
