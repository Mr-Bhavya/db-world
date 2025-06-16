package com.db.dbworld.config;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "dbworld")
public class DbWorldPropertiesConfig {

    private Paths paths;
    private ApiKeys api_keys;

    @Getter
    @Setter
    public static class Paths {
        private String tempDownloadPath;
        private String logFilePath;
        private String log4j2LogPath;
        private String downloadLogPath;
        private String integrationFolderPath;
        private String streamHomePath;
        private String externalStreamHomePath;
        private String torrentDownloadPath;
        private String ytDlp;
        private String mediainfo;
        private String hsCookiesPath;
        private String extHDiskPath;
    }

    @Getter
    @Setter
    public static class ApiKeys {
        private String tmdb;
    }

    @PostConstruct
    public void initLogPath() {
        if (paths != null && paths.getLogFilePath() != null) {
            System.setProperty("DBWORLD_LOG_PATH", paths.getLog4j2LogPath());
        }
    }

}
