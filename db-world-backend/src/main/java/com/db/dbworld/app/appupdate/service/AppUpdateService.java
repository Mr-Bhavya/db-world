package com.db.dbworld.app.appupdate.service;

import com.db.dbworld.app.appupdate.model.AppVersionInfo;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

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

    /**
     * Whether we can answer yet, and if not, why not.
     *
     * <p>These were previously indistinguishable: both produced a bare 404, so the updater
     * read "the backend restarted two seconds ago" as "no build has ever been published" and
     * silently skipped the update. Worse, a 404 with no cache headers is something browsers
     * will happily cache, turning a few-second window into a persistent failure on that
     * device.
     */
    public enum Availability {
        /** No lookup has succeeded yet — starting up, or GitHub is unreachable. Ask again shortly. */
        WARMING,
        /** GitHub answered and there is a build to serve. */
        AVAILABLE,
        /** GitHub answered and there is genuinely nothing published. */
        EMPTY
    }

    /** One consistent read of the cache, so the release and the reason can never disagree. */
    public record Lookup(AppVersionInfo info, String apkUrl, Availability availability) {}

    private volatile Snapshot cached;
    private volatile long nextFetchAt;   // don't hit GitHub again until this time (success OR failure)

    /**
     * Set only once GitHub has actually ANSWERED and had nothing for us. A network failure or
     * a rate-limit response must never land here — "we could not ask" is not the same claim as
     * "there is no release", and reporting the second when we mean the first is what made the
     * updater skip a published build.
     */
    private volatile boolean confirmedEmpty;

    /** Guards a single in-flight background refresh so bursts don't fan out to GitHub. */
    private final AtomicBoolean refreshing = new AtomicBoolean(false);
    private final ExecutorService refreshExec = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "app-update-refresh");
        t.setDaemon(true);
        return t;
    });

    /** Warm the cache at startup (in the background) so the first real request is instant. */
    @PostConstruct
    void warm() {
        snapshot();
    }

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

    /**
     * The release and the reason it might be missing, resolved in one read.
     *
     * <p>Deliberately a single call: asking for the APK and then separately asking why it was
     * absent lets a refresh land between the two and report a state that was never true.
     */
    public Lookup lookup() {
        Snapshot s = snapshot();
        if (s != null) {
            return new Lookup(s.info(), s.githubApkUrl(), Availability.AVAILABLE);
        }
        return new Lookup(null, null, confirmedEmpty ? Availability.EMPTY : Availability.WARMING);
    }

    private Snapshot snapshot() {
        long now = System.currentTimeMillis();
        // Refresh in the BACKGROUND — never block the request thread on the GitHub
        // round-trip. An unreachable GitHub (e.g. no egress in dev) was hanging
        // /api/app/download for ~80s before 404ing; now every request returns the
        // last cached value (or null) instantly and the refresh happens off-thread.
        if (now >= nextFetchAt && refreshing.compareAndSet(false, true)) {
            // Back off for the full TTL immediately, success OR failure — otherwise a
            // failing fetch leaves the window "expired" and every request re-triggers,
            // burning GitHub's 60/hr unauthenticated rate limit.
            nextFetchAt = now + CACHE_TTL_MS;
            refreshExec.submit(() -> {
                try {
                    Snapshot s = fetchFromGitHub();
                    if (s != null) {
                        cached = s; // keep the previous good value if a refresh returns nothing
                        confirmedEmpty = false;
                    } else {
                        // fetchFromGitHub only returns null when GitHub ANSWERED and had
                        // nothing usable; transport failures throw and land in the catch.
                        confirmedEmpty = true;
                    }
                } catch (Exception e) {
                    // Deliberately does NOT set confirmedEmpty: we failed to ask, which tells
                    // us nothing about whether a release exists.
                    log.warn("GitHub release lookup failed: {} — keeping last cached value", e.toString());
                } finally {
                    refreshing.set(false);
                }
            });
        }
        return cached; // may be null (never published, or first lookup hasn't completed yet)
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
                apkSize,
                n.path("releaseAudience").asText("all")  // "all" | "admin"; missing field → "all" (safe default)
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
        if (resp.statusCode() == 404) {
            // A real answer: the repo has no releases. Distinct from the cases below.
            log.info("GET {} returned 404 — nothing published", url);
            return null;
        }
        if (resp.statusCode() != 200) {
            // Rate limit, 5xx, anything else: we did not get an answer. Throwing keeps this
            // out of the "nothing published" path and leaves the last good value in place.
            throw new IOException("GET " + url + " returned " + resp.statusCode());
        }
        return MAPPER.readTree(resp.body());
    }
}
