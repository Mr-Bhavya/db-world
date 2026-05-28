package com.db.dbworld.config;

import jakarta.annotation.PostConstruct;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.validation.annotation.Validated;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;

/**
 * Single source-of-truth for application runtime configuration.
 * Bound to the {@code app.*} prefix in application.yml.
 * Resolves and validates all paths in {@code @PostConstruct}.
 */
@Component
@ConfigurationProperties(prefix = "app")
@Validated
public class AppProperties {

    // ── Config-bound fields (Spring Boot setter binding) ─────────────────────

    @NotBlank private String name;
    @NotBlank private String version;
    @NotBlank private String basePath;
    @NotBlank private String dataPath;
    @NotBlank private String streamPath;
    @NotBlank private String symlinkPath;

    @Valid private Paths paths;
    @Valid private Tools tools;
    private ApiKeys apiKeys;
    private Tokens tokens;
    private Cdn cdn;

    // ── Runtime fields (resolved in @PostConstruct) ───────────────────────────

    private List<String> activeProfiles;

    private Path basePathR;
    private Path dataPathR;
    private Path streamPathR;
    private Path symlinkPathR;

    private Path tempPath;
    private Path downloadsPath;
    private Path integrationPath;
    private Path torrentsPath;
    private Path externalVideosPath;
    private List<Path> mediaBasePaths;

    private Path logsPath;
    private Path mainLogPath;
    private Path downloadLogPath;
    private Path archivedLogsPath;

    private String ytDlp;
    private String ffmpeg;
    private String sevenZip;
    private String mediaInfo;
    private Path   hsCookies;
    private Path   cookiesDir;

    private String tmdbApiKey;
    private String tmdbAccessToken;
    private String cdnBaseUrl;

    @Autowired
    private org.springframework.core.env.Environment environment;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @PostConstruct
    void init() {
        activeProfiles = List.of(environment.getActiveProfiles());

        basePathR    = norm(basePath);
        dataPathR    = norm(dataPath);
        streamPathR  = norm(streamPath);
        symlinkPathR = norm(symlinkPath);

        if (paths != null) {
            tempPath          = norm(paths.temp());
            downloadsPath     = norm(paths.downloads());
            integrationPath   = norm(paths.integration());
            torrentsPath      = norm(paths.torrents());
            externalVideosPath= norm(paths.externalVideos());
            logsPath          = norm(paths.logs());
            mainLogPath       = norm(paths.mainLog());
            downloadLogPath   = norm(paths.downloadLog());
            archivedLogsPath  = norm(paths.archivedLogs());
        }

        if (tools != null) {
            ytDlp      = tools.ytDlp();
            ffmpeg     = tools.ffmpeg();
            sevenZip   = tools.sevenZip();
            mediaInfo  = tools.mediainfo();
            hsCookies  = norm(tools.hsCookies());
            cookiesDir = norm(tools.cookiesDir());
        }

        tmdbApiKey      = apiKeys  != null ? apiKeys.tmdb()  : null;
        tmdbAccessToken = tokens   != null ? tokens.tmdb()   : null;

        String rawCdn = (cdn != null && StringUtils.hasText(cdn.baseUrl()))
                ? cdn.baseUrl() : "http://cdn.db-world.in";
        cdnBaseUrl = rawCdn.endsWith("/") ? rawCdn.substring(0, rawCdn.length() - 1) : rawCdn;

        mediaBasePaths = Stream.of(tempPath, integrationPath)
                .filter(Objects::nonNull).toList();

        createDirs(basePathR, dataPathR, streamPathR, tempPath,
                downloadsPath, integrationPath, logsPath, archivedLogsPath);
    }

    // ── Public API ────────────────────────────────────────────────────────────

    public String       getName()               { return name; }
    public String       getVersion()            { return version; }
    public List<String> getActiveProfiles()     { return activeProfiles; }

    public Path         getBasePath()           { return basePathR; }
    public Path         getDataPath()           { return dataPathR; }
    public Path         getStreamPath()         { return streamPathR; }
    public Path         getSymlinkPath()        { return symlinkPathR; }

    public Path         getTempPath()           { return tempPath; }
    public Path         getDownloadsPath()      { return downloadsPath; }
    public Path         getIntegrationPath()    { return integrationPath; }
    public Path         getTorrentsPath()       { return torrentsPath; }
    public Path         getExternalVideosPath() { return externalVideosPath; }
    public List<Path>   getMediaBasePaths()     { return mediaBasePaths; }

    public Path         getLogsPath()           { return logsPath; }
    public Path         getMainLogPath()        { return mainLogPath; }
    public Path         getDownloadLogPath()    { return downloadLogPath; }
    public Path         getArchivedLogsPath()   { return archivedLogsPath; }

    public String       getYtDlp()              { return ytDlp; }
    public String       getFfmpeg()             { return ffmpeg; }
    public String       getSevenZip()           { return sevenZip; }
    public String       getMediaInfo()          { return mediaInfo; }
    public Path         getHsCookies()           { return hsCookies; }
    public Path         getCookiesDir()          { return cookiesDir; }

    /**
     * Returns the cookie file for the given URL, or null if none is configured.
     * Checks cookiesDir/<domain-prefix>.txt first, then legacy hsCookies for hotstar.
     */
    public Path getCookieForUrl(String url) {
        if (url == null) return null;
        String lower = url.toLowerCase();
        if (cookiesDir != null) {
            for (String domain : AppConstants.YTDLP_COOKIE_DOMAINS) {
                if (lower.contains(domain)) {
                    String prefix = domain.replace(".com", "").replace(".in", "");
                    Path candidate = cookiesDir.resolve(prefix + ".txt");
                    if (java.nio.file.Files.exists(candidate)) return candidate;
                }
            }
        }
        // Legacy fallback for hotstar
        if (lower.contains(AppConstants.HOTSTAR_COM) && hsCookies != null) return hsCookies;
        return null;
    }

    public String       getTmdbApiKey()         { return tmdbApiKey; }
    public String       getTmdbAccessToken()    { return tmdbAccessToken; }
    public String       getCdnBaseUrl()         { return cdnBaseUrl; }

    // ── Setters (required by Spring Boot @ConfigurationProperties binding) ────

    public void setName(String v)       { this.name = v; }
    public void setVersion(String v)    { this.version = v; }
    public void setBasePath(String v)   { this.basePath = v; }
    public void setDataPath(String v)   { this.dataPath = v; }
    public void setStreamPath(String v) { this.streamPath = v; }
    public void setSymlinkPath(String v){ this.symlinkPath = v; }
    public void setPaths(Paths v)       { this.paths = v; }
    public void setTools(Tools v)       { this.tools = v; }
    public void setApiKeys(ApiKeys v)   { this.apiKeys = v; }
    public void setTokens(Tokens v)     { this.tokens = v; }
    public void setCdn(Cdn v)           { this.cdn = v; }

    // ── Nested config records ─────────────────────────────────────────────────

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
            /** Legacy: Hotstar cookie file. Prefer cookiesDir for new platforms. */
            String hsCookies,
            /**
             * Directory containing per-platform cookie files.
             * Naming convention: <domain-prefix>.txt
             * e.g. /etc/dbworld/cookies/hotstar.txt, sonyliv.txt, zee5.txt
             */
            String cookiesDir
    ) {}

    public record ApiKeys(String tmdb) {}
    public record Tokens(String tmdb)  {}
    public record Cdn(String baseUrl)  {}

    // ── Utilities ─────────────────────────────────────────────────────────────

    private static Path norm(String value) {
        return StringUtils.hasText(value) ? Path.of(StringUtils.cleanPath(value)) : null;
    }

    private static void createDirs(Path... dirs) {
        for (Path dir : dirs) {
            if (dir == null) continue;
            try {
                Files.createDirectories(dir);
            } catch (Exception ex) {
                throw new IllegalStateException("Failed to create directory: " + dir, ex);
            }
        }
    }
}
