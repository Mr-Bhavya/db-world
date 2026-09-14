package com.db.dbworld.app.appupdate.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.appupdate.model.AppVersionInfo;
import com.db.dbworld.app.appupdate.service.AppUpdateService;
import com.db.dbworld.app.appupdate.service.AppUpdateService.Availability;
import com.db.dbworld.app.appupdate.service.AppUpdateService.Lookup;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

/**
 * In-app updater endpoints (public — the app checks before login).
 *   GET /api/app/version   → latest build metadata (sourced from the latest GitHub Release)
 *   GET /api/app/download  → 302-redirects to the release's APK on GitHub
 *
 * The download path is kept relative + served here so ALL installed apps (which only
 * ever build {@code <apiBase>/api/app/download}) keep working when the source moves
 * to GitHub. The native updater follows the redirect.
 *
 * <p><b>Why a cold cache answers 503 and not 404.</b> The release is resolved from GitHub in
 * the background, so for a moment after every restart there is simply no answer yet. That
 * used to return a bare 404 — identical to "nothing has ever been published" — with two
 * consequences: the updater treated a live release as absent and skipped it, and because the
 * response carried no cache headers, browsers were free to store it, turning a two-second
 * window into a lasting failure on that device. Every response here is now {@code no-store},
 * and "not ready yet" is a retryable 503 rather than a claim about what exists.
 */
@RestController
@RequestMapping("/api/app")
@RequiredArgsConstructor
public class AppUpdateController {

    /** Seconds the client should wait before asking again while the lookup warms. */
    private static final String RETRY_AFTER_SECONDS = "5";

    /**
     * Nothing on these endpoints may be cached. The payload turns over whenever a release is
     * published, and a stored negative response is exactly the failure this class exists to
     * avoid.
     */
    private static final CacheControl NO_STORE = CacheControl.noStore().mustRevalidate();

    private final AppUpdateService appUpdateService;

    @GetMapping("/version")
    public ResponseEntity<ApiResponse<AppVersionInfo>> version() {
        Lookup lookup = appUpdateService.lookup();

        if (lookup.availability() == Availability.AVAILABLE) {
            return ResponseEntity.ok().cacheControl(NO_STORE).body(ApiResponse.success(lookup.info()));
        }
        if (lookup.availability() == Availability.WARMING) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .cacheControl(NO_STORE)
                    .header(HttpHeaders.RETRY_AFTER, RETRY_AFTER_SECONDS)
                    .body(ApiResponse.error(HttpStatus.SERVICE_UNAVAILABLE,
                            "Release lookup is still warming up — retry shortly", null));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .cacheControl(NO_STORE)
                .body(ApiResponse.error(HttpStatus.NOT_FOUND, "No release published yet", null));
    }

    @GetMapping("/download")
    public ResponseEntity<Void> download() {
        Lookup lookup = appUpdateService.lookup();

        if (lookup.availability() == Availability.AVAILABLE) {
            // 302 to the GitHub release asset; the native downloader follows the redirect.
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(lookup.apkUrl()))
                    .cacheControl(NO_STORE)
                    .build();
        }
        if (lookup.availability() == Availability.WARMING) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .cacheControl(NO_STORE)
                    .header(HttpHeaders.RETRY_AFTER, RETRY_AFTER_SECONDS)
                    .build();
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).cacheControl(NO_STORE).build();
    }
}
