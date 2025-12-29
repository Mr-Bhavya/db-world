package com.db.dbworld.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "app")
public record DbWorldProperties(

        @NotBlank String name,
        @NotBlank String version,
        @NotBlank String basePath,
        @NotBlank String dataPath,
        @NotBlank String streamPath,

        @Valid Paths paths,
        @Valid Tools tools,
        @Valid ApiKeys apiKeys,
        @Valid Tokens tokens
) {

    public record Paths(
            @NotBlank String logs,
            @NotBlank String mainLog,
            @NotBlank String downloadLog,
            @NotBlank String config,
            @NotBlank String temp,
            @NotBlank String downloads,
            @NotBlank String integration,
            @NotBlank String torrents,
            @NotBlank String archivedLogs,
            @NotBlank String externalVideos
    ) {}

    public record Tools(
            @NotBlank String ytDlp,
            @NotBlank String ffmpeg,
            @NotBlank String sevenZip,
            @NotBlank String mediainfo,
            String hsCookies
    ) {}

    public record ApiKeys(String tmdb) {}

    public record Tokens(String tmdb) {}
}
