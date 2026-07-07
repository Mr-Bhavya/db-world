package com.db.dbworld.app.stream.service;

import com.db.dbworld.app.stream.enums.StreamType;
import com.db.dbworld.config.AppProperties;
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
 *   <li><b>ID-based</b> ({@code /id/{uuid}}) â€” for record-linked media files
 *       served via the symlink directory.</li>
 *   <li><b>Path-based</b> ({@code /path/{relPath}}) â€” for unassigned files
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

    private final AppProperties runtime;
    private final CdnSigner     cdnSigner;

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Public builders
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /**
     * Builds a CDN URL for a record-linked file identified by its media-file UUID.
     * The UUID doubles as the symlink filename under the symlink root.
     */
    public String buildByMediaFileId(String mediaFileId, String userId, StreamType type,
                                      String fileName, String requestId) {
        String uriPath = "/id/" + mediaFileId;
        return base() + uriPath
                + queryParams(userId, type, fileName, requestId)
                + cdnSigner.signatureSuffix(uriPath, type);
    }

    /**
     * Builds a CDN URL for an unassigned file identified by its path relative to the
     * stream / external-videos root.
     */
    public String buildByRelativePath(String relativePath, String userId, StreamType type,
                                       String fileName, String requestId) {
        String clean = StringUtils.cleanPath(relativePath);
        if (clean.startsWith("/")) clean = clean.substring(1);
        // Signature is over the DECODED path (what nginx exposes as $uri); the URL itself
        // carries the percent-encoded segments.
        String uriPathDecoded = "/path/" + clean;
        return base() + "/path/" + encodePathSegments(clean)
                + queryParams(userId, type, fileName, requestId)
                + cdnSigner.signatureSuffix(uriPathDecoded, type);
    }

    /**
     * Auto-detects whether {@code accelPath} is under the symlink root, stream root,
     * or external-videos root, and builds the appropriate CDN URL.
     * Throws {@link IllegalArgumentException} if the path is outside all allowed roots.
     */
    public String buildFromAbsolutePath(Path accelPath, String userId, StreamType type,
                                         String fileName, String requestId) {
        Path normalized   = accelPath.toAbsolutePath().normalize();
        Path symlinkRoot  = runtime.getSymlinkPath().toAbsolutePath().normalize();
        Path streamRoot   = runtime.getStreamPath().toAbsolutePath().normalize();
        Path externalRoot = runtime.getExternalVideosPath().toAbsolutePath().normalize();

        if (normalized.startsWith(symlinkRoot)) {
            String mediaFileId = symlinkRoot.relativize(normalized).toString();
            return buildByMediaFileId(mediaFileId, userId, type, fileName, requestId);
        } else if (normalized.startsWith(streamRoot)) {
            String rel = streamRoot.relativize(normalized).toString().replace('\\', '/');
            return buildByRelativePath(rel, userId, type, fileName, requestId);
        } else if (normalized.startsWith(externalRoot)) {
            String rel = externalRoot.relativize(normalized).toString().replace('\\', '/');
            return buildByRelativePath(rel, userId, type, fileName, requestId);
        }

        log.error("Path outside allowed media roots: {}", normalized);
        throw new IllegalArgumentException("Path outside allowed media roots: " + normalized);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // ID generators
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /**
     * Generates a unique per-request tracing ID. This is the sole correlation key
     * between the resolve event and the downstream nginx access-log lines.
     */
    public String generateRequestId() {
        return UUID.randomUUID().toString();
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Internal helpers
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private String base() {
        return runtime.getCdnBaseUrl(); // trailing slash already stripped in AppProperties
    }

    private String queryParams(String userId, StreamType type, String fileName,
                                String requestId) {
        return "?userId="       + encode(userId)
             + "&type="         + type.name()
             + "&originalFile=" + encode(fileName)
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
