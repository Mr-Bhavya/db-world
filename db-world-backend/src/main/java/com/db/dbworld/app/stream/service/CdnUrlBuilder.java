package com.db.dbworld.app.stream.service;

import com.db.dbworld.app.stream.enums.StreamType;
import com.db.dbworld.utils.DbWorldRuntimeProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.util.UriUtils;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Builds CDN URLs for the {@code cdn.db-world.in} subdomain.
 *
 * Two access schemes are supported:
 * <ul>
 *   <li><b>ID-based</b> ({@code /id/{uuid}}) — for record-linked media files
 *       served via the symlink directory.</li>
 *   <li><b>Path-based</b> ({@code /path/{relPath}}) — for unassigned files
 *       served directly from the stream / external-videos root.</li>
 * </ul>
 *
 * Query params embedded in every CDN URL are captured by nginx's {@code cdn_json}
 * log format for per-request tracking without any server round-trip.
 */
@Log4j2
@Component
@RequiredArgsConstructor
public class CdnUrlBuilder {

    private final DbWorldRuntimeProperties runtime;

    // ──────────────────────────────────────────────────────────────────────────
    // Public builders
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Builds a CDN URL for a record-linked file identified by its media-file UUID.
     * The UUID doubles as the symlink filename under the symlink root.
     */
    public String buildByMediaFileId(String mediaFileId, String userId, StreamType type,
                                      String fileName, String downloadId, String requestId) {
        return base() + "/id/" + mediaFileId
                + queryParams(userId, type, fileName, downloadId, requestId);
    }

    /**
     * Builds a CDN URL for an unassigned file identified by its path relative to the
     * stream / external-videos root.
     */
    public String buildByRelativePath(String relativePath, String userId, StreamType type,
                                       String fileName, String downloadId, String requestId) {
        String clean = StringUtils.cleanPath(relativePath);
        if (clean.startsWith("/")) clean = clean.substring(1);
        return base() + "/path/" + encodePathSegments(clean)
                + queryParams(userId, type, fileName, downloadId, requestId);
    }

    /**
     * Auto-detects whether {@code accelPath} is under the symlink root, stream root,
     * or external-videos root, and builds the appropriate CDN URL.
     * Throws {@link IllegalArgumentException} if the path is outside all allowed roots.
     */
    public String buildFromAbsolutePath(Path accelPath, String userId, StreamType type,
                                         String fileName, String downloadId, String requestId) {
        Path normalized   = accelPath.toAbsolutePath().normalize();
        Path symlinkRoot  = runtime.getSymlinkPath().toAbsolutePath().normalize();
        Path streamRoot   = runtime.getStreamPath().toAbsolutePath().normalize();
        Path externalRoot = runtime.getExternalVideosPath().toAbsolutePath().normalize();

        if (normalized.startsWith(symlinkRoot)) {
            String mediaFileId = symlinkRoot.relativize(normalized).toString();
            return buildByMediaFileId(mediaFileId, userId, type, fileName, downloadId, requestId);
        } else if (normalized.startsWith(streamRoot)) {
            String rel = streamRoot.relativize(normalized).toString().replace('\\', '/');
            return buildByRelativePath(rel, userId, type, fileName, downloadId, requestId);
        } else if (normalized.startsWith(externalRoot)) {
            String rel = externalRoot.relativize(normalized).toString().replace('\\', '/');
            return buildByRelativePath(rel, userId, type, fileName, downloadId, requestId);
        }

        log.error("Path outside allowed media roots: {}", normalized);
        throw new IllegalArgumentException("Path outside allowed media roots: " + normalized);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ID generators
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Generates a download-session ID that is stable within the same calendar day
     * for the same user + file reference (so multiple range requests in one session
     * share the same ID for nginx-log correlation).
     */
    public String generateDownloadId(String userId, String fileRef) {
        long dayBucket = System.currentTimeMillis() / 86_400_000L;
        String seed    = userId + "|" + fileRef + "|" + dayBucket;
        return "DL_" + Integer.toHexString(Math.abs(seed.hashCode()))
                + "_" + (System.currentTimeMillis() % 100_000L);
    }

    /** Generates a unique per-request tracing ID. */
    public String generateRequestId() {
        return UUID.randomUUID().toString();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ──────────────────────────────────────────────────────────────────────────

    private String base() {
        return runtime.getCdnBaseUrl(); // trailing slash already stripped in DbWorldRuntimeProperties
    }

    private String queryParams(String userId, StreamType type, String fileName,
                                String downloadId, String requestId) {
        return "?userId="       + encode(userId)
             + "&type="         + type.name()
             + "&originalFile=" + encode(fileName)
             + "&downloadId="   + downloadId
             + "&requestId="    + requestId;
    }

    private String encodePathSegments(String path) {
        if (path == null || path.isEmpty()) return "";

        return Arrays.stream(path.split("/"))
                .map(segment -> UriUtils.encodePathSegment(segment, StandardCharsets.UTF_8))
                .collect(Collectors.joining("/"));
    }

    private String encode(String value) {
        return value == null ? "" : URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
