package com.db.dbworld.config;

import jakarta.annotation.PostConstruct;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.validation.annotation.Validated;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
@Log4j2
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
    private MediaDisk mediaDisk;

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
    private List<Path> mediaTreeRoots;
    private Path mediaDiskMarker;

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

    // CDN URL signing (nginx secure_link). Secret is shared with the nginx config.
    private boolean cdnSigningEnabled;
    private String  cdnSigningSecret;
    private long    cdnStreamTtlSeconds;
    private long    cdnDownloadTtlSeconds;

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

        Cdn.Signing signing = cdn != null ? cdn.signing() : null;
        cdnSigningEnabled     = signing != null && signing.enabled() != null && signing.enabled();
        cdnSigningSecret      = signing != null ? signing.secret() : null;
        cdnStreamTtlSeconds   = signing != null && signing.streamTtlSeconds()   != null ? signing.streamTtlSeconds()   : 21_600L;   // 6h
        cdnDownloadTtlSeconds = signing != null && signing.downloadTtlSeconds() != null ? signing.downloadTtlSeconds() : 172_800L;  // 48h

        mediaBasePaths = Stream.of(tempPath, integrationPath)
                .filter(Objects::nonNull).toList();

        // Everything that lives on the media disk. In prod all of it sits under data-path; the
        // other roots are listed so a media dir configured elsewhere still counts as media.
        mediaTreeRoots = Stream.of(dataPathR, streamPathR, symlinkPathR, tempPath,
                        downloadsPath, integrationPath, torrentsPath)
                .filter(Objects::nonNull)
                .map(p -> p.toAbsolutePath().normalize())
                .distinct().toList();
        mediaDiskMarker = mediaDisk != null ? norm(mediaDisk.marker()) : null;

        createDirs();
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

    /** Absolute roots of the tree that lives on the media disk (data, streams, symlinks, temp...). */
    public List<Path>   getMediaTreeRoots()     { return mediaTreeRoots; }

    /**
     * File the host admin created once ON the media disk. Present means the disk is mounted.
     * Null when {@code app.media-disk.marker} is blank, which turns the check off.
     */
    public Path         getMediaDiskMarker()    { return mediaDiskMarker; }

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

    public boolean      isCdnSigningEnabled()     { return cdnSigningEnabled; }
    public String       getCdnSigningSecret()     { return cdnSigningSecret; }
    public long         getCdnStreamTtlSeconds()  { return cdnStreamTtlSeconds; }
    public long         getCdnDownloadTtlSeconds(){ return cdnDownloadTtlSeconds; }

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
    public void setMediaDisk(MediaDisk v) { this.mediaDisk = v; }

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
    public record Cdn(String baseUrl, Signing signing) {

        /** nginx secure_link signing. Secret must match the nginx {@code secure_link_md5} directive. */
        public record Signing(
                Boolean enabled,
                String  secret,
                Long    streamTtlSeconds,
                Long    downloadTtlSeconds
        ) {}
    }

    /**
     * {@code marker}: a file on the media disk itself, e.g. {@code /srv/dbworld/.dbworld-media-disk}.
     * Blank turns the media-disk guard off (dev machines have no marker).
     */
    public record MediaDisk(String marker) {}

    // ── Utilities ─────────────────────────────────────────────────────────────

    private static Path norm(String value) {
        return StringUtils.hasText(value) ? Path.of(StringUtils.cleanPath(value)) : null;
    }

    /**
     * Best-effort directory creation. NEVER throws: a missing/unmountable path
     * (e.g. an external HDD that isn't plugged in) must not abort application
     * startup, since this bean is depended on by every feature in the app.
     * <p>
     * Critical dirs are expected to live on internal storage (the app's own
     * home) — failures are logged at {@code ERROR}. Optional dirs may live on
     * removable/external storage — failures are logged at {@code WARN} since
     * they're expected to be transient (e.g. disk unmounted).
     * <p>
     * When the media-disk marker is configured but absent, the disk is not mounted and
     * {@code data-path} is just the empty mount point on the SD card. Nothing in the media tree
     * is created then: a tree built there would take writes onto the SD and be hidden again the
     * moment the disk mounts over it.
     */
    private void createDirs() {
        Map<String, Path> critical = new LinkedHashMap<>();
        critical.put("basePath", basePathR);
        critical.put("dataPath", dataPathR);
        critical.put("tempPath", tempPath);
        critical.put("logsPath", logsPath);
        critical.put("archivedLogsPath", archivedLogsPath);

        Map<String, Path> optional = new LinkedHashMap<>();
        optional.put("streamPath", streamPathR);
        optional.put("downloadsPath", downloadsPath);
        optional.put("integrationPath", integrationPath);

        if (mediaDiskMarker != null && !Files.exists(mediaDiskMarker)) {
            List<String> skipped = new ArrayList<>();
            skipped.addAll(removeMediaTreeDirs(critical));
            skipped.addAll(removeMediaTreeDirs(optional));
            if (!skipped.isEmpty()) {
                log.warn("Startup: media disk marker {} is missing, so the media disk is not mounted. "
                        + "Not creating {} under {}: {}", mediaDiskMarker, skipped.size(), dataPathR, skipped);
            }
        }

        List<String> missing = new ArrayList<>();
        missing.addAll(createDirs(critical, true));
        missing.addAll(createDirs(optional, false));

        int total = critical.size() + optional.size();
        if (!missing.isEmpty()) {
            log.info("Startup: {} of {} configured directories unavailable: {}", missing.size(), total, missing);
        } else {
            log.info("Startup: all {} configured directories are ready", total);
        }
    }

    /** Drops every dir inside the media tree from {@code dirs}; returns "name (path)" for each one dropped. */
    private List<String> removeMediaTreeDirs(Map<String, Path> dirs) {
        List<String> removed = new ArrayList<>();
        dirs.entrySet().removeIf(entry -> {
            Path dir = entry.getValue();
            if (dir == null || !isInMediaTree(dir)) return false;
            removed.add(entry.getKey() + " (" + dir + ")");
            return true;
        });
        return removed;
    }

    private boolean isInMediaTree(Path dir) {
        Path p = dir.toAbsolutePath().normalize();
        return mediaTreeRoots.stream().anyMatch(p::startsWith);
    }

    /** Attempts to create each named dir; returns the names of those that failed. Never throws. */
    private List<String> createDirs(Map<String, Path> dirs, boolean critical) {
        List<String> failed = new ArrayList<>();
        for (Map.Entry<String, Path> entry : dirs.entrySet()) {
            String name = entry.getKey();
            Path dir = entry.getValue();
            if (dir == null) continue;
            try {
                Files.createDirectories(dir);
            } catch (Exception ex) {
                failed.add(name);
                if (critical) {
                    log.error("Critical directory {} could not be created — dependent features will be unavailable", dir, ex);
                } else {
                    log.warn("Optional directory {} is unavailable (external disk not mounted?) — features using it will be unavailable until it returns", dir, ex);
                }
            }
        }
        return failed;
    }
}
