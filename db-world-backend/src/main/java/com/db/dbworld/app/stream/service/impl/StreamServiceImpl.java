package com.db.dbworld.app.stream.service.impl;

import com.db.dbworld.app.media.info.dto.MediaFileDto;
import com.db.dbworld.app.media.info.service.MediaInfoService;
import com.db.dbworld.app.stream.dto.CdnResolveDto;
import com.db.dbworld.app.stream.enums.StreamType;
import com.db.dbworld.app.stream.service.CdnUrlBuilder;
import com.db.dbworld.app.stream.service.StreamService;
import com.db.dbworld.audit.tracking.ingest.TrackingIngestService;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.helpers.DbWorldRecords;
import com.db.dbworld.config.AppProperties;
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

    private final AppProperties  runtime;
    private final DbWorldUtils              dbWorldUtils;
    private final MediaInfoService          mediaInfoService;
    private final CdnUrlBuilder             cdnUrlBuilder;
    private final TrackingIngestService     trackingIngestService;

    private final Map<String, String> normalizedCache = new ConcurrentHashMap<>();

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Resolve â€” returns CDN URL as JSON for direct player / download use
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

        recordResolveEvent(user, inline, requestId, mediaFile.getId(), mediaFile.getRecordId(),
                mediaFile.getTmdbSeasonNumber(), mediaFile.getTmdbEpisodeNumber(),
                realFile.toString(), mediaFile.getFileName(), fileSize, remoteAddr, userAgent);

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

        CdnResolveDto.CdnResolveDtoBuilder builder = CdnResolveDto.builder()
                .cdnUrl(cdnUrl)
                .downloadId(downloadId)
                .requestId(requestId)
                .fileName(fileName)
                .fileSize(fileSize)
                .mimeType(dbWorldUtils.determineContentType(realFile).toString())
                .type(type.name());

        // Enrich from DB if a MediaFileEntity exists for this path
        var enrichedMediaFile = mediaInfoService.getByFilePath(realFile.toAbsolutePath().toString());
        enrichedMediaFile.ifPresent(mf ->
                builder.mediaFileId(mf.getId())
                       .recordId(mf.getRecordId())
                       .mediaFile(mf));

        recordResolveEvent(user, inline, requestId,
                enrichedMediaFile.map(MediaFileDto::getId).orElse(null),
                enrichedMediaFile.map(MediaFileDto::getRecordId).orElse(null),
                enrichedMediaFile.map(MediaFileDto::getTmdbSeasonNumber).orElse(null),
                enrichedMediaFile.map(MediaFileDto::getTmdbEpisodeNumber).orElse(null),
                realFile.toString(), fileName, fileSize, remoteAddr, userAgent);

        return builder.build();
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Activity tracking
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /**
     * Emits the new-pipeline RESOLVE tracking event (Plan 1B). Best-effort only — any
     * failure here (bad args, downstream exception) must never affect the resolve response
     * or the live streaming path, so every exception is swallowed and merely logged.
     */
    private void recordResolveEvent(String user, boolean inline, String requestId, String mediaFileId,
                                     Long recordId, Integer seasonNumber, Integer episodeNumber,
                                     String filePath, String fileName, long fileSize,
                                     String remoteAddr, String userAgent) {
        try {
            trackingIngestService.recordResolve(user, inline, requestId, mediaFileId, recordId,
                    seasonNumber, episodeNumber, filePath, fileName, fileSize, remoteAddr, userAgent);
        } catch (Exception e) {
            log.warn("recordResolveEvent failed for user={}, requestId={}", user, requestId, e);
        }
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Internal helpers
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @Override
    public Path resolveRealPath(String relativePath) {

        String clean = StringUtils.cleanPath(relativePath);

        Path inputPath = Path.of(clean);
//        if (inputPath.isAbsolute() || clean.matches("^[a-zA-Z]:.*")) {
//            log.error("Absolute path detected (SECURITY RISK): {}", clean);
//            throw new DbWorldException("Absolute paths are not allowed: " + clean);
//        }

        String normalized = clean.startsWith("/") || clean.startsWith("\\")
                ? clean.substring(1)
                : clean;

        Path candidate = runtime.getStreamPath()
                .resolve(normalized)
                .normalize();

        if (Files.exists(candidate)) return candidate;

        Path external = runtime.getExternalVideosPath()
                .resolve(normalized)
                .normalize();

        if (Files.exists(external)) return external;

        return candidate;
    }

    private long resolveFileSize(Long known, Path file) {
        if (known != null) return known;
        try { return Files.size(file); } catch (IOException e) { return 0L; }
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Discovery
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Fuzzy matching helpers
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
            // ðŸš¨ DO NOT return absolute fallback
            throw new DbWorldException("File is outside allowed directories: " + fullPath);
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
