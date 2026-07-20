package com.db.dbworld.app.appupdate.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.appupdate.model.AppVersionInfo;
import com.db.dbworld.app.appupdate.service.AppUpdateService;
import lombok.RequiredArgsConstructor;
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
 */
@RestController
@RequestMapping("/api/app")
@RequiredArgsConstructor
public class AppUpdateController {

    private final AppUpdateService appUpdateService;

    @GetMapping("/version")
    public ResponseEntity<ApiResponse<AppVersionInfo>> version() {
        AppVersionInfo info = appUpdateService.getLatest();
        if (info == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.<AppVersionInfo>error(HttpStatus.NOT_FOUND, "No release published yet", null));
        }
        return ResponseEntity.ok(ApiResponse.success(info));
    }

    @GetMapping("/download")
    public ResponseEntity<Void> download() {
        String apkUrl = appUpdateService.getLatestApkUrl();
        if (apkUrl == null) {
            return ResponseEntity.notFound().build();
        }
        // 302 to the GitHub release asset; the native downloader follows the redirect.
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(apkUrl))
                .build();
    }
}
