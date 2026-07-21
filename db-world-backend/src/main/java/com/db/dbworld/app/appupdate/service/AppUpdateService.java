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
import java.time.Duration;

/**
 * Resolves the latest published Android build for the in-app updater
 * ({@code GET /api/app/version}) from the project's latest GitHub Release.
 *
 * The Release workflow (.github/workflows/release.yml) attaches a {@code version.json}
 * asset ({ versionCode, versionName, mandatory, minSupportedCode, apkUrl, changelog })
 * plus the signed APK. We read that metadata and hand the app a RELATIVE download path
 * ({@code /api/app/download}) which 302-redirects to the GitHub APK — so EVERY already-
 * installed app keeps working unchanged (it only ever sees the same relative endpoints
 * it always has), while publishing a new build is just pushing a {@code v*} tag.
 *
 * The lookup is cached briefly so a burst of app launches doesn't exhaust GitHub's
 * unauthenticated rate limit (60 req/hr per IP). On failure we serve the last cached
 * value (or null → the app silently skips the update).
 */
@Slf4j
@Service
public class AppUpdateService {

    /** Relative path the app hits to download — 302s to GitHub (kept relative for old builds). */
    public static final String DOWNLOAD_PATH = "/api/app/download";
    private static final String META_ASSET = "version.json";
    private static final long CACHE_TTL_MS = 5 * 60 * 1000L;

    // Self-contained mapper — the app context doesn't expose an ObjectMapper bean.
    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** owner/repo whose latest release feeds the updater. */
    @Value("${app.github-repo:Mr-Bhavya/db-world}")
    private String githubRepo;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    /** Cached lookup: what the app sees (info) + the real GitHub APK URL (download target). */
    private record Snapshot(AppVersionInfo info, String githubApkUrl) {}

    private volatile Snapshot cached;
    private volatile long nextFetchAt;   // don't hit GitHub again until this time (success OR failure)

    /** @return latest build metadata (with a relative apkUrl), or {@code null}. */
    public AppVersionInfo getLatest() {
        Snapshot s = snapshot();
        return s == null ? null : s.info();
    }

    /** @return the GitHub APK URL the {@code /api/app/download} redirect points at, or {@code null}. */
    public String getLatestApkUrl() {
        Snapshot s = snapshot();
        return s == null ? null : s.githubApkUrl();
    }

    private Snapshot snapshot() {
        long now = System.currentTimeMillis();
        if (now < nextFetchAt) {
            return cached;
        }
        try {
            Snapshot s = fetchFromGitHub();
            if (s != null) {
                cached = s; // refresh; keep the previous good value if a refresh returns nothing
            }
        } catch (Exception e) {
            log.warn("GitHub release lookup failed: {} — keeping last cached value", e.toString());
        }
        // Back off for the full TTL whether the fetch SUCCEEDED or FAILED — otherwise a
        // failing fetch leaves the window "expired" and every request re-hits GitHub,
        // burning the 60/hr unauthenticated rate limit and freezing on stale data.
        nextFetchAt = now + CACHE_TTL_MS;
        return cached; // may be null (never published, or first lookup failed)
    }

    private Snapshot fetchFromGitHub() throws Exception {
        JsonNode rel = getJson("https://api.github.com/repos/" + githubRepo + "/releases/latest");
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
        String githubApkUrl = n.path("apkUrl").asText(apkUrl == null ? "" : apkUrl);
        if (githubApkUrl.isEmpty()) {
            log.warn("Latest release has no APK URL");
            return null;
        }

        AppVersionInfo info = new AppVersionInfo(
                n.path("versionCode").asLong(0L),
                n.path("versionName").asText(""),
                DOWNLOAD_PATH,   // relative — resolved by the app against its API base (old + new builds)
                n.path("mandatory").asBoolean(false),
                n.path("minSupportedCode").asLong(0L),
                n.path("changelog").asText(""),
                apkSize
        );
        return new Snapshot(info, githubApkUrl);
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
}
