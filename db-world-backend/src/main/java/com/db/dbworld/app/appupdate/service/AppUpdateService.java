package com.db.dbworld.app.appupdate.service;

import com.db.dbworld.app.appupdate.model.AppVersionInfo;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.time.Duration;

/**
 * Resolves the latest published Android build for the in-app updater
 * ({@code GET /api/app/version}) from the project's latest GitHub Release.
 *
 * The Release workflow (.github/workflows/release.yml) attaches a {@code version.json}
 * asset ({ versionCode, versionName, mandatory, minSupportedCode, apkUrl, changelog })
 * plus the signed APK. We read that metadata and hand the app the GitHub APK URL, so
 * publishing a new build is just pushing a {@code v*} tag — no scp, no backend redeploy.
 *
 * Result is cached briefly so a burst of app launches doesn't exhaust GitHub's
 * unauthenticated rate limit (60 req/hr per IP). On any failure we serve the last
 * cached value (or null → the app silently skips the update).
 */
@Slf4j
@Service
public class AppUpdateService {

    public static final String APK_FILE = "app-release.apk";
    private static final String META_ASSET = "version.json";
    private static final long CACHE_TTL_MS = 5 * 60 * 1000L;

    // Self-contained mapper — the app context doesn't expose an ObjectMapper bean.
    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** owner/repo whose latest release feeds the updater. */
    @Value("${app.github-repo:Mr-Bhavya/db-world}")
    private String githubRepo;

    // Retained for the legacy GET /api/app/download (kept for backward compatibility;
    // unused once apkUrl points at GitHub).
    @Value("${app.release-dir:/app/db_world/releases}")
    private String releaseDir;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    private volatile AppVersionInfo cached;
    private volatile long cachedAt;

    /** @return latest build info, or {@code null} if nothing is published / GitHub is unreachable. */
    public AppVersionInfo getLatest() {
        long now = System.currentTimeMillis();
        AppVersionInfo c = cached;
        if (c != null && now - cachedAt < CACHE_TTL_MS) {
            return c;
        }
        try {
            AppVersionInfo info = fetchFromGitHub();
            if (info != null) {
                cached = info;
                cachedAt = now;
                return info;
            }
        } catch (Exception e) {
            log.warn("GitHub release lookup failed: {} — serving last cached value", e.toString());
        }
        return cached; // may be null (never published, or first lookup failed)
    }

    private AppVersionInfo fetchFromGitHub() throws Exception {
        String api = "https://api.github.com/repos/" + githubRepo + "/releases/latest";
        JsonNode rel = getJson(api);
        if (rel == null) {
            return null;
        }

        String metaUrl = null;
        String apkUrl = null;
        long apkSize = 0L;
        for (JsonNode a : rel.path("assets")) {
            String name = a.path("name").asText("");
            String dl = a.path("browser_download_url").asText("");
            if (META_ASSET.equals(name)) {
                metaUrl = dl;
            } else if (name.endsWith(".apk")) {
                apkUrl = dl;
                apkSize = a.path("size").asLong(0L);
            }
        }
        if (metaUrl == null) {
            log.warn("Latest release '{}' has no {} asset", rel.path("tag_name").asText("?"), META_ASSET);
            return null;
        }

        JsonNode n = getJson(metaUrl);
        if (n == null) {
            return null;
        }
        // apkUrl embedded in version.json wins; fall back to the .apk asset URL.
        String resolvedApkUrl = n.path("apkUrl").asText(apkUrl == null ? "" : apkUrl);
        return new AppVersionInfo(
                n.path("versionCode").asLong(0L),
                n.path("versionName").asText(""),
                resolvedApkUrl,
                n.path("mandatory").asBoolean(false),
                n.path("minSupportedCode").asLong(0L),
                n.path("changelog").asText(""),
                apkSize
        );
    }

    private JsonNode getJson(String url) throws Exception {
        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .header("Accept", "application/vnd.github+json")
                .header("User-Agent", "db-world-backend")
                .timeout(Duration.ofSeconds(10))
                .GET()
                .build();
        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() != 200) {
            log.warn("GET {} returned {}", url, resp.statusCode());
            return null;
        }
        return MAPPER.readTree(resp.body());
    }

    /** Absolute path to a locally-published APK (legacy GET /api/app/download). */
    public Path getApkPath() {
        return Path.of(releaseDir, APK_FILE);
    }
}
