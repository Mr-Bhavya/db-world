package com.db.dbworld.app.appupdate.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.appupdate.model.AppVersionInfo;
import com.db.dbworld.app.appupdate.service.AppUpdateService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * In-app updater endpoints (public — the app checks before login).
 *   GET /api/app/version   → latest build metadata
 *   GET /api/app/download  → streams the signed APK
 */
@RestController
@RequestMapping("/api/app")
@RequiredArgsConstructor
public class AppUpdateController {

    private static final MediaType APK_MEDIA_TYPE =
            MediaType.parseMediaType("application/vnd.android.package-archive");

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
    public ResponseEntity<Resource> download() throws IOException {
        Path apk = appUpdateService.getApkPath();
        if (!Files.isRegularFile(apk)) {
            return ResponseEntity.notFound().build();
        }
        Resource body = new FileSystemResource(apk);
        return ResponseEntity.ok()
                .contentType(APK_MEDIA_TYPE)
                .contentLength(Files.size(apk))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"db-world.apk\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-cache")
                .body(body);
    }
}
