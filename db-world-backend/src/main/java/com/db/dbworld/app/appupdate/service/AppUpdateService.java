package com.db.dbworld.app.appupdate.service;

import com.db.dbworld.app.appupdate.model.AppVersionInfo;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Reads the latest published Android build metadata from the release directory.
 *
 * The Jenkins pipeline drops two files into {@code app.release-dir}:
 *   - app-release.apk  (the signed build)
 *   - version.json     ({ versionCode, versionName, mandatory, minSupportedCode, changelog })
 *
 * Decoupling via the filesystem means publishing a new build is just a file
 * copy — no backend redeploy.
 */
@Slf4j
@Service
public class AppUpdateService {

    public static final String APK_FILE = "app-release.apk";
    private static final String META_FILE = "version.json";

    // Self-contained mapper — the app context doesn't expose an ObjectMapper bean.
    private static final ObjectMapper MAPPER = new ObjectMapper();

    // Default matches the prod server layout (app.base-path=/app/db_world) and the
    // Jenkins ANDROID_RELEASE_DIR, so it's correct even if app.release-dir isn't set.
    @Value("${app.release-dir:/app/db_world/releases}")
    private String releaseDir;

    /** @return latest build info, or {@code null} if nothing has been published yet. */
    public AppVersionInfo getLatest() {
        Path meta = Path.of(releaseDir, META_FILE);
        if (!Files.isRegularFile(meta)) {
            return null;
        }
        try {
            JsonNode n = MAPPER.readTree(meta.toFile());
            Path apk = Path.of(releaseDir, APK_FILE);
            long size = Files.isRegularFile(apk) ? Files.size(apk) : 0L;
            return new AppVersionInfo(
                    n.path("versionCode").asLong(0),
                    n.path("versionName").asText(""),
                    "/api/app/download",
                    n.path("mandatory").asBoolean(false),
                    n.path("minSupportedCode").asLong(0),
                    n.path("changelog").asText(""),
                    size
            );
        } catch (IOException e) {
            log.error("Failed to read {} in {}", META_FILE, releaseDir, e);
            return null;
        }
    }

    /** Absolute path to the published APK (may not exist yet). */
    public Path getApkPath() {
        return Path.of(releaseDir, APK_FILE);
    }
}
