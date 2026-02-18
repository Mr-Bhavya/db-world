package com.db.dbworld.utils;

import com.db.dbworld.config.DbWorldProperties;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;

@Getter
@Component
public class DbWorldRuntimeProperties {

    /* App */
    private final String appName;
    private final String appVersion;
    private final List<String> activeProfiles;

    /* Paths */
    private final Path basePath;
    private final Path dataPath;
    private final Path streamPath;
    private final Path symlinkPath;

    private final Path tempPath;
    private final Path downloadsPath;
    private final Path integrationPath;
    private final Path torrentsPath;
    private final Path externalVideosPath;

    private final List<Path> mediaBasePaths;

    /* Logs */
    private final Path logsPath;
    private final Path mainLogPath;
    private final Path downloadLogPath;
    private final Path archivedLogsPath;

    /* Tools */
    private final String ytDlp;
    private final String ffmpeg;
    private final String sevenZip;
    private final String mediaInfo;
    private final Path hsCookies;

    /* API */
    private final String tmdbApiKey;
    private final String tmdbAccessToken;

    public DbWorldRuntimeProperties(
            DbWorldProperties props,
            Environment environment
    ) {

        this.appName = props.name();
        this.appVersion = props.version();
        this.activeProfiles = List.of(environment.getActiveProfiles());

        this.basePath = clean(props.basePath());
        this.dataPath = clean(props.dataPath());
        this.streamPath = clean(props.streamPath());
        this.symlinkPath = clean(props.symlinkPath());

        var p = props.paths();

        this.tempPath = clean(p.temp());
        this.downloadsPath = clean(p.downloads());
        this.integrationPath = clean(p.integration());
        this.torrentsPath = clean(p.torrents());
        this.externalVideosPath = clean(p.externalVideos());

        this.mediaBasePaths = Stream.of(tempPath, integrationPath)
                .filter(Objects::nonNull)
                .toList();

        this.logsPath = clean(p.logs());
        this.mainLogPath = clean(p.mainLog());
        this.downloadLogPath = clean(p.downloadLog());
        this.archivedLogsPath = clean(p.archivedLogs());

        var t = props.tools();

        this.ytDlp = t.ytDlp();
        this.ffmpeg = t.ffmpeg();
        this.sevenZip = t.sevenZip();
        this.mediaInfo = t.mediainfo();
        this.hsCookies = clean(t.hsCookies());

        this.tmdbApiKey = props.apiKeys() != null ? props.apiKeys().tmdb() : null;
        this.tmdbAccessToken = props.tokens() != null ? props.tokens().tmdb() : null;
    }

    /* ---------------- Path Creation ---------------- */

    @PostConstruct
    void createDirectories() {
        createDir(basePath);
        createDir(dataPath);
        createDir(streamPath);
        createDir(tempPath);
        createDir(downloadsPath);
        createDir(integrationPath);
        createDir(logsPath);
        createDir(archivedLogsPath);
    }

    private void createDir(Path path) {
        try {
            if (path != null) {
                Files.createDirectories(path);
            }
        } catch (Exception ex) {
            throw new IllegalStateException(
                    "Failed to create directory: " + path, ex
            );
        }
    }

    private Path clean(String value) {
        return StringUtils.hasText(value)
                ? Path.of(StringUtils.cleanPath(value))
                : null;
    }
}
