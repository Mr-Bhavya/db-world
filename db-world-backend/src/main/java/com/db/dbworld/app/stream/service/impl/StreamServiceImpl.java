package com.db.dbworld.app.stream.service.impl;

import com.db.dbworld.app.media.info.service.MediaInfoService;
import com.db.dbworld.app.stream.enums.StreamType;
import com.db.dbworld.app.stream.service.StreamService;
import com.db.dbworld.audit.activity.service.UserCinemaActivityService;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.helpers.DbWorldRecords;
import com.db.dbworld.core.processor.ProcessExecutor;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldRuntimeProperties;
import com.db.dbworld.utils.DbWorldUtils;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.DigestUtils;
import org.springframework.util.StringUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.Normalizer;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Media file streaming service.
 * Migrated from com.db.dbworld.services.media.impl.StreamServiceImpl.
 *
 * Changes from original:
 * - Uses {@link MediaInfoService#getById(String)} instead of deprecated MediaFileInfoService
 *   to resolve real file path in streamById()
 * - Removed getMediaInfoByFileId() and parseMediaInfo() — those belong to MediaInfoService
 */
@Log4j2
@Service
@Transactional
@RequiredArgsConstructor
public class StreamServiceImpl implements StreamService {

    private final DbWorldRuntimeProperties      runtime;
    private final DbWorldUtils                  dbWorldUtils;
    private final ProcessExecutor               processExecutor;
    private final UserCinemaActivityService     activityService;
    private final MediaInfoService              mediaInfoService;

    private final Map<String, String> normalizedCache = new ConcurrentHashMap<>();

    // ──────────────────────────────────────────────────────────────────────────
    // Streaming
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public ResponseEntity<Void> streamByPath(String user, Path path, String rangeHeader, boolean inline) {
        log.info("streamByPath: user={}, path={}, inline={}", user, path, inline);
        Objects.requireNonNull(user, "user must not be null");
        Objects.requireNonNull(path, "path must not be null");

        try {
            Path resolvedPath = runtime.getStreamPath().resolve(path);
            log.debug("Resolved streamPath={}", resolvedPath);
            return streamInternal(user, resolvedPath, resolvedPath, rangeHeader, inline);
        } catch (Exception e) {
            log.error("Error in streamByPath for user={}, path={}", user, path, e);
            throw new DbWorldException("Failed to stream by path", e);
        }
    }

    @Override
    public ResponseEntity<Void> streamById(String user, String mediaFileId, String rangeHeader, boolean inline) {
        log.info("streamById: user={}, mediaFileId={}, inline={}", user, mediaFileId, inline);
        try {
            Path symlinkPath = runtime.getSymlinkPath().resolve(mediaFileId);
            String filePath = mediaInfoService.getById(mediaFileId)
                    .map(dto -> dto.getFilePath())
                    .orElseThrow(() -> new DbWorldException("File not found for mediaFileId: " + mediaFileId));
            Path realFilePath = Path.of(filePath);
            log.debug("Resolved symlinkPath={}, realFilePath={}", symlinkPath, realFilePath);
            if (!Files.exists(realFilePath)) {
                log.error("File does not exist: {}", realFilePath);
                throw new DbWorldException("File not found: " + realFilePath);
            }
            return streamInternal(user, symlinkPath, realFilePath, rangeHeader, inline);
        } catch (Exception e) {
            log.error("Error in streamById for user={}, mediaFileId={}", user, mediaFileId, e);
            throw e instanceof DbWorldException ? (DbWorldException) e : new DbWorldException("Failed to stream by ID", e);
        }
    }

    private ResponseEntity<Void> streamInternal(String user, Path accelPath, Path realFile, String rangeHeader, boolean inline) {
        log.info("streamInternal: user={}, accelPath={}, realFile={}, inline={}", user, accelPath, realFile, inline);
        try {
            if (!Files.exists(realFile)) {
                log.error("Real file does not exist: {}", realFile);
                throw new DbWorldException("File not found: " + realFile);
            }
            if (!Files.isReadable(realFile)) {
                log.error("Real file is not readable: {}", realFile);
                throw new DbWorldException("File not readable: " + realFile);
            }

            DbWorldRecords.FileSizeInfo sizeInfo = dbWorldUtils.getFileSizeInfo(realFile);
            DbWorldRecords.RangeInfo rangeInfo = parseRangeHeader(rangeHeader, sizeInfo.fileSize());
            HttpHeaders headers = buildHeaders(user, accelPath, realFile, rangeInfo, inline);

            trackActivity(user, realFile, sizeInfo.fileSize(), rangeHeader, inline);

            log.info("Streaming: user={}, file={}, size={}, partial={}",
                    user, realFile.getFileName(), sizeInfo.fileSize(), rangeInfo.isPartial());
            return ResponseEntity.ok().headers(headers).build();
        } catch (DbWorldException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error in streamInternal for user={}, file={}", user, realFile, e);
            throw new DbWorldException("Streaming failed", e);
        }
    }

    private DbWorldRecords.RangeInfo parseRangeHeader(String header, long fileSize) {
        if (header == null || !header.startsWith("bytes=")) {
            return new DbWorldRecords.RangeInfo(0, false);
        }
        try {
            long start = Long.parseLong(header.substring(6).split("-")[0]);
            return new DbWorldRecords.RangeInfo(start, true);
        } catch (Exception e) {
            log.error("Invalid range header: {}", header, e);
            throw new DbWorldException("Invalid Range header", e);
        }
    }

    private HttpHeaders buildHeaders(String user, Path accelPath, Path realFile,
                                     DbWorldRecords.RangeInfo rangeInfo, boolean inline) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.ACCEPT_RANGES, "bytes");
            String accelRedirect = buildAccelRedirectUrl(accelPath, user, rangeInfo.rangeStart(), inline);
            headers.add("X-Accel-Redirect", accelRedirect);
            headers.setContentType(dbWorldUtils.determineContentType(realFile));
            headers.setContentDisposition(dbWorldUtils.createContentDisposition(realFile, inline));
            log.debug("Headers built: X-Accel-Redirect={}", accelRedirect);
            return headers;
        } catch (Exception e) {
            log.error("Error building headers for user={}, file={}", user, realFile, e);
            throw new DbWorldException("Failed to build headers", e);
        }
    }

    private String buildAccelRedirectUrl(Path path, String user, long rangeStart, boolean inline) {
        try {
            Path normalized    = path.toAbsolutePath().normalize();
            Path symlinkRoot   = runtime.getSymlinkPath().toAbsolutePath().normalize();
            Path streamRoot    = runtime.getStreamPath().toAbsolutePath().normalize();
            Path externalRoot  = runtime.getExternalVideosPath().toAbsolutePath().normalize();

            final String baseLocation;
            final Path relativePath;

            if (normalized.startsWith(symlinkRoot)) {
                baseLocation = DbWorldConstants.CDN_STREAM_ID;
                relativePath = symlinkRoot.relativize(normalized);
            } else if (normalized.startsWith(streamRoot)) {
                baseLocation = DbWorldConstants.CDN_STREAM_PATH;
                relativePath = streamRoot.relativize(normalized);
            } else if (normalized.startsWith(externalRoot)) {
                baseLocation = DbWorldConstants.CDN_STREAM_PATH;
                relativePath = externalRoot.relativize(normalized);
            } else {
                log.error("Path outside allowed media roots: {}", normalized);
                throw new IllegalArgumentException("Path outside allowed media roots: " + normalized);
            }

            String cleanPath    = StringUtils.cleanPath(relativePath.toString());
            String encodedUser  = URLEncoder.encode(user, StandardCharsets.UTF_8);
            String requestId    = UUID.randomUUID().toString();
            String type         = inline ? StreamType.ONLINE.name() : StreamType.DOWNLOAD.name();

            return baseLocation + cleanPath
                    + "?userId="       + encodedUser
                    + "&rangeStart="   + rangeStart
                    + "&downloadId="   + requestId
                    + "&requestId="    + requestId
                    + "&type="         + type
                    + "&originalFile=" + URLEncoder.encode(normalized.toString(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("Error building redirect URL for path={}, user={}", path, user, e);
            throw new DbWorldException("Failed to build redirect URL", e);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Activity tracking
    // ──────────────────────────────────────────────────────────────────────────

    private void trackActivity(String user, Path file, long size, String range, boolean inline) {
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs == null) {
                log.warn("No request attributes for activity tracking");
                return;
            }
            HttpServletRequest req = attrs.getRequest();
            String ip = dbWorldUtils.getClientIpAddress(req);
            String ua = req.getHeader("User-Agent");

            if (inline) {
                activityService.trackStreamActivity(user, file.toString(), file.getFileName().toString(), size, range, ip, ua);
            } else {
                activityService.trackDownloadActivity(user, file.toString(), file.getFileName().toString(), size, range, ip, ua);
            }
        } catch (Exception e) {
            log.warn("Activity tracking failed for user={}", user, e);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Discovery
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public List<DbWorldRecords.StreamableFileInfo> listRecursive(Path dir) {
        log.info("listRecursive: dir={}", dir);
        if (!Files.isDirectory(dir)) {
            log.warn("Not a directory: {}", dir);
            return Collections.emptyList();
        }
        try (Stream<Path> stream = Files.walk(dir)) {
            List<DbWorldRecords.StreamableFileInfo> result = stream
                    .filter(Files::isRegularFile)
                    .map(this::buildDetails)
                    .collect(Collectors.toList());
            log.debug("Found {} files in {}", result.size(), dir);
            return result;
        } catch (IOException e) {
            log.error("Failed to list files in directory: {}", dir, e);
            throw new DbWorldException("Failed to list files in " + dir, e);
        }
    }

    @Override
    public List<DbWorldRecords.StreamableFileInfo> listAllStreamable() {
        List<DbWorldRecords.StreamableFileInfo> list = new ArrayList<>();
        list.addAll(listRecursive(runtime.getStreamPath()));
        list.addAll(listRecursive(runtime.getExternalVideosPath()));
        log.info("Total streamable files: {}", list.size());
        return list;
    }

    @Override
    public boolean matchesQuery(String fileName, String query) {
        if (fileName == null || query == null) return false;

        String normalizedFile  = normalize(fileName);
        String normalizedQuery = normalize(query);

        if (normalizedFile.contains(normalizedQuery))           return true;
        if (isOrderedSubsequence(normalizedQuery, normalizedFile)) return true;

        String[] queryTokens = normalizedQuery.split("\\s+");
        for (String token : queryTokens) {
            if (token.length() < 3 && !normalizedFile.contains(token)) return false;
        }

        return Arrays.stream(queryTokens)
                .parallel()
                .allMatch(token ->
                        normalizedFile.contains(token) ||
                        (token.length() >= 3 && containsNearMatchOptimized(normalizedFile, token)));
    }

    private String normalize(String input) {
        return normalizedCache.computeIfAbsent(input, k -> {
            String noAccent = Normalizer.normalize(k, Normalizer.Form.NFD)
                    .replaceAll("\\p{M}", "");
            return noAccent.toLowerCase()
                    .replaceAll("[^a-z0-9]", " ")
                    .replaceAll("\\s+", " ")
                    .trim();
        });
    }

    private boolean isOrderedSubsequence(String query, String text) {
        int q = 0;
        for (int t = 0; q < query.length() && t < text.length(); t++) {
            if (query.charAt(q) == text.charAt(t)) q++;
        }
        return q == query.length();
    }

    private boolean containsNearMatchOptimized(String text, String token) {
        int tokenLen = token.length();
        for (int windowSize = Math.max(3, tokenLen - 1);
             windowSize <= Math.min(text.length(), tokenLen + 1);
             windowSize++) {
            for (int i = 0; i <= text.length() - windowSize; i++) {
                if (levenshteinDistanceLeq1(text.substring(i, i + windowSize), token)) return true;
            }
        }
        return false;
    }

    private boolean levenshteinDistanceLeq1(String a, String b) {
        int lenA = a.length(), lenB = b.length();
        int diff = Math.abs(lenA - lenB);
        if (diff > 1) return false;

        if (diff == 1) {
            String shorter = lenA < lenB ? a : b;
            String longer  = lenA < lenB ? b : a;
            for (int i = 0; i < longer.length(); i++) {
                if ((longer.substring(0, i) + longer.substring(i + 1)).equals(shorter)) return true;
            }
            return false;
        }

        int mismatches = 0;
        for (int i = 0; i < lenA; i++) {
            if (a.charAt(i) != b.charAt(i) && ++mismatches > 1) return false;
        }
        return mismatches == 1;
    }

    @Override
    public Optional<Path> resolvePathByFileId(String fileId) {
        return listAllStreamable().stream()
                .filter(f -> f.fileId().equalsIgnoreCase(fileId))
                .map(info -> Path.of(runtime.getStreamPath().toString(), StringUtils.cleanPath(info.filePath())))
                .findFirst();
    }

    @Override
    public DbWorldRecords.StreamableFileInfo buildDetails(Path path) {
        try {
            long size = Files.size(path);
            String id = DigestUtils.md5DigestAsHex(
                    path.toAbsolutePath().toString().getBytes(StandardCharsets.UTF_8));
            return new DbWorldRecords.StreamableFileInfo(
                    path.getFileName().toString(),
                    toRelativePath(path),
                    false,
                    true,
                    size,
                    id
            );
        } catch (IOException e) {
            log.error("Failed to read file details: {}", path, e);
            throw new DbWorldException("Failed to read file details for " + path, e);
        }
    }

    private String toRelativePath(Path fullPath) {
        String normalized  = StringUtils.cleanPath(fullPath.toString());
        String streamRoot  = StringUtils.cleanPath(runtime.getStreamPath().toString());
        String externalRoot = StringUtils.cleanPath(runtime.getExternalVideosPath().toString());

        String result;
        if (normalized.startsWith(streamRoot)) {
            result = normalized.substring(streamRoot.length());
        } else if (normalized.startsWith(externalRoot)) {
            result = normalized.substring(externalRoot.length());
        } else {
            result = fullPath.getFileName().toString();
        }

        return result.startsWith("/") ? result : "/" + result;
    }
}
