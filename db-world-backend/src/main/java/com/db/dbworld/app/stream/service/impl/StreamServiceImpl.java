package com.db.dbworld.app.stream.service.impl;

import com.db.dbworld.app.media.info.service.MediaInfoService;
import com.db.dbworld.app.stream.dto.CdnResolveDto;
import com.db.dbworld.app.stream.enums.StreamType;
import com.db.dbworld.app.stream.service.CdnUrlBuilder;
import com.db.dbworld.app.stream.service.StreamService;
import com.db.dbworld.audit.activity.service.UserCinemaActivityService;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.helpers.DbWorldRecords;
import com.db.dbworld.utils.DbWorldRuntimeProperties;
import com.db.dbworld.utils.DbWorldUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.DigestUtils;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.Normalizer;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Log4j2
@Service
@Transactional
@RequiredArgsConstructor
public class StreamServiceImpl implements StreamService {

    private final DbWorldRuntimeProperties  runtime;
    private final DbWorldUtils              dbWorldUtils;
    private final UserCinemaActivityService activityService;
    private final MediaInfoService          mediaInfoService;
    private final CdnUrlBuilder             cdnUrlBuilder;

    private final Map<String, String> normalizedCache = new ConcurrentHashMap<>();

    // ──────────────────────────────────────────────────────────────────────────
    // Resolve — returns CDN URL as JSON for direct player / download use
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public CdnResolveDto resolveById(String user, String mediaFileId, boolean inline,
                                      String userAgent, String remoteAddr) {
        log.info("resolveById: user={}, mediaFileId={}, inline={}", user, mediaFileId, inline);

        var mediaFile = mediaInfoService.getById(mediaFileId)
                .orElseThrow(() -> new DbWorldException("MediaFile not found: " + mediaFileId));

        Path realFile = Path.of(mediaFile.getFilePath());
        if (!Files.exists(realFile)) {
            throw new DbWorldException("File does not exist on disk: " + mediaFile.getFilePath());
        }

        StreamType type       = inline ? StreamType.ONLINE : StreamType.DOWNLOAD;
        String     downloadId = cdnUrlBuilder.generateDownloadId(user, mediaFileId);
        String     requestId  = cdnUrlBuilder.generateRequestId();
        String     fileName   = mediaFile.getFileName();
        long       fileSize   = resolveFileSize(mediaFile.getFileSize(), realFile);

        String cdnUrl = cdnUrlBuilder.buildByMediaFileId(mediaFileId, user, type, fileName, downloadId, requestId);

        trackResolveActivity(user, realFile, fileSize, inline, remoteAddr, userAgent, downloadId, cdnUrl);

        return CdnResolveDto.builder()
                .cdnUrl(cdnUrl)
                .downloadId(downloadId)
                .requestId(requestId)
                .fileName(fileName)
                .fileSize(fileSize)
                .mimeType(mediaFile.getMimeType())
                .type(type.name())
                .mediaFileId(mediaFileId)
                .recordId(mediaFile.getRecordId())
                .mediaFile(mediaFile)
                .build();
    }

    @Override
    public CdnResolveDto resolveByPath(String user, String relativePath, boolean inline,
                                        String userAgent, String remoteAddr) {
        log.info("resolveByPath: user={}, path={}, inline={}", user, relativePath, inline);

        Path realFile = resolveRealPath(relativePath);
        if (!Files.exists(realFile)) {
            throw new DbWorldException("File not found at path: " + relativePath);
        }

        StreamType type       = inline ? StreamType.ONLINE : StreamType.DOWNLOAD;
        String     downloadId = cdnUrlBuilder.generateDownloadId(user, relativePath);
        String     requestId  = cdnUrlBuilder.generateRequestId();
        String     fileName   = realFile.getFileName().toString();
        long       fileSize   = resolveFileSize(null, realFile);

        String cdnUrl = cdnUrlBuilder.buildByRelativePath(
                relativePath, user, type, fileName, downloadId, requestId);

        trackResolveActivity(user, realFile, fileSize, inline, remoteAddr, userAgent, downloadId, cdnUrl);

        CdnResolveDto.CdnResolveDtoBuilder builder = CdnResolveDto.builder()
                .cdnUrl(cdnUrl)
                .downloadId(downloadId)
                .requestId(requestId)
                .fileName(fileName)
                .fileSize(fileSize)
                .mimeType(dbWorldUtils.determineContentType(realFile).toString())
                .type(type.name());

        // Enrich from DB if a MediaFileEntity exists for this path
        mediaInfoService.getByFilePath(realFile.toAbsolutePath().toString()).ifPresent(mf ->
                builder.mediaFileId(mf.getId())
                       .recordId(mf.getRecordId())
                       .mediaFile(mf));

        return builder.build();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Activity tracking
    // ──────────────────────────────────────────────────────────────────────────

    private void trackResolveActivity(String user, Path file, long size, boolean inline,
                                       String ip, String ua, String downloadId, String cdnUrl) {
        try {
            activityService.trackResolveActivity(
                    user, file.toString(), file.getFileName().toString(),
                    size, ip, ua, inline, downloadId, cdnUrl);
        } catch (Exception e) {
            log.warn("Resolve activity tracking failed for user={}", user, e);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ──────────────────────────────────────────────────────────────────────────

    private Path resolveRealPath(String relativePath) {
        String clean = StringUtils.cleanPath(relativePath);
        Path candidate = runtime.getStreamPath().resolve(clean).normalize();
        if (Files.exists(candidate)) return candidate;
        return runtime.getExternalVideosPath().resolve(clean).normalize();
    }

    private long resolveFileSize(Long known, Path file) {
        if (known != null) return known;
        try { return Files.size(file); } catch (IOException e) { return 0L; }
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

        if (normalizedFile.contains(normalizedQuery))              return true;
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

    // ──────────────────────────────────────────────────────────────────────────
    // Fuzzy matching helpers
    // ──────────────────────────────────────────────────────────────────────────

    private String toRelativePath(Path fullPath) {
        String normalized   = StringUtils.cleanPath(fullPath.toString());
        String streamRoot   = StringUtils.cleanPath(runtime.getStreamPath().toString());
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
}
