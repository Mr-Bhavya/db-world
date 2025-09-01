package com.db.dbworld.config;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "app")
public class DbWorldPropertiesConfig {

    private String name;
    private String version;
    private String basePath;
    private String dataPath;
    private String streamPath;

    private Paths paths;
    private Tools tools;

    private ApiKeys apiKeys;

    @Getter
    @Setter
    public static class Paths {
        private String logs;
        private String mainLog;
        private String downloadLog;
        private String config;
        private String temp;
        private String downloads;
        private String integration;
        private String torrents;
        private String archivedLogs;
        private String externalVideos;
    }

    @Getter
    @Setter
    public static class Tools {
        private String ytDlp;
        private String mediainfo;
        private String hsCookies;
    }

    @Getter
    @Setter
    public static class ApiKeys {
        private String tmdb;
    }

    @PostConstruct
    public void initLogPath() {
        if (paths != null && paths.getLogs() != null) {
            // Set system property for logging to use elsewhere
            System.setProperty("DBWORLD_LOG_PATH", paths.getLogs());
            System.setProperty("DBWORLD_ARCHIVED_LOG_PATH", paths.getArchivedLogs());
        }
    }
}
