package com.db.dbworld.services.media.impl;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.helpers.DbWorldRecords;
import com.db.dbworld.helpers.ProcessExecutor;
import com.db.dbworld.payloads.dbcinema.stream.MediaFileInfo;
import com.db.dbworld.services.DownloadType;
import com.db.dbworld.services.media.MediaFileInfoService;
import com.db.dbworld.services.media.StreamService;
import com.db.dbworld.services.user.UserCinemaActivityService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldRuntimeProperties;
import com.db.dbworld.utils.DbWorldUtils;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.*;
import jakarta.servlet.http.HttpServletRequest;
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

@Service
@Log4j2
@Transactional
public class StreamServiceImpl implements StreamService {

    private final DbWorldRuntimeProperties runtime;
    private final DbWorldUtils dbWorldUtils;
    private final ProcessExecutor processExecutor;
    private final UserCinemaActivityService activityService;
    private final MediaFileInfoService mediaFileInfoService;
    private final Map<String, String> normalizedCache = new ConcurrentHashMap<>();

    public StreamServiceImpl(DbWorldRuntimeProperties runtime, DbWorldUtils dbWorldUtils, ProcessExecutor processExecutor, UserCinemaActivityService activityService, MediaFileInfoService mediaFileInfoService) {
        log.info("StreamServiceImpl initialized with runtime={}, dbWorldUtils={}, processExecutor={}, activityService={}, mediaFileInfoService={}",
                runtime != null, dbWorldUtils != null, processExecutor != null, activityService != null, mediaFileInfoService != null);
        this.runtime = runtime;
        this.dbWorldUtils = dbWorldUtils;
        this.processExecutor = processExecutor;
        this.activityService = activityService;
        this.mediaFileInfoService = mediaFileInfoService;
        log.debug("Initialized paths - symlinkPath: {}, streamPath: {}, externalVideosPath: {}",
                runtime.getSymlinkPath(), runtime.getStreamPath(), runtime.getExternalVideosPath());
    }

    @Override
    public ResponseEntity<Void> streamByPath(String user, Path path, String rangeHeader, boolean inline) {
        log.info("streamByPath called: user={}, path={}, rangeHeader={}, inline={}", user, path, rangeHeader, inline);
        Objects.requireNonNull(user, "user must not be null");
        Objects.requireNonNull(path, "path must not be null");

        try {
            Path streamPath = Path.of(runtime.getStreamPath().toString(), path.toString());
            Path resolvedPath = runtime.getStreamPath().resolve(path);
            log.debug("Resolved streamPath={}, resolvedPath={}", streamPath, resolvedPath);
            return streamInternal(user, resolvedPath, resolvedPath, rangeHeader, inline);
        } catch (Exception e) {
            log.error("Error in streamByPath for user={}, path={}", user, path, e);
            throw new DbWorldException("Failed to stream by path", e);
        }
    }

    @Override
    public ResponseEntity<Void> streamById(String user, String mediaFileId, String rangeHeader, boolean inline) {
        log.info("streamById called: user={}, mediaFileId={}, rangeHeader={}, inline={}", user, mediaFileId, rangeHeader, inline);
        try {
            Path symlinkPath = runtime.getSymlinkPath().resolve(mediaFileId);
            String fileInfo = mediaFileInfoService.getFileInfoById(mediaFileId);
            log.debug("Retrieved file info for mediaFileId={}: {}", mediaFileId, fileInfo);
            Path realFilePath = Path.of(fileInfo);
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
        log.info("streamInternal called: user={}, accelPath={}, realFile={}, rangeHeader={}, inline={}",
                user, accelPath, realFile, rangeHeader, inline);

        try {
            // Validate accelPath exists (for symlinks, check if parent directory exists)
            Path accelParent = accelPath.getParent();
            if (accelParent != null && !Files.exists(accelParent)) {
                log.warn("Accel path parent directory does not exist: {}", accelParent);
            }

            // Validate real file exists
            if (!Files.exists(realFile)) {
                log.error("Real file does not exist: {}", realFile);
                throw new DbWorldException("File not found: " + realFile);
            }

            if (!Files.isReadable(realFile)) {
                log.error("Real file is not readable: {}", realFile);
                throw new DbWorldException("File not readable: " + realFile);
            }

            DbWorldRecords.FileSizeInfo sizeInfo = dbWorldUtils.getFileSizeInfo(realFile);
            log.debug("File size info: fileSize={}", sizeInfo.fileSize());

            DbWorldRecords.RangeInfo rangeInfo = parseRangeHeader(rangeHeader, sizeInfo.fileSize());
            log.debug("Range info: rangeStart={}, isPartial={}", rangeInfo.rangeStart(), rangeInfo.isPartial());

//            HttpHeaders headers = buildHeaders(user, accelPath, realFile, sizeInfo, rangeInfo, inline);
            HttpHeaders headers = buildHeaders(user, accelPath, realFile, rangeInfo, inline);
            HttpStatus status = rangeInfo.isPartial() ? HttpStatus.PARTIAL_CONTENT : HttpStatus.OK;
            log.debug("Response status: {}", status);

            trackActivity(user, realFile, sizeInfo.fileSize(), rangeHeader, inline);

            log.info("Streaming successful: user={}, file={}, size={}, status={}",
                    user, realFile.getFileName(), sizeInfo.fileSize(), status);
            return ResponseEntity.ok().headers(headers).build();
        } catch (DbWorldException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error in streamInternal for user={}, file={}", user, realFile, e);
            throw new DbWorldException("Streaming failed", e);
        }
    }

    private DbWorldRecords.RangeInfo parseRangeHeader(String header, long fileSize) {
        log.debug("parseRangeHeader called: header={}, fileSize={}", header, fileSize);
        if (header == null || !header.startsWith("bytes=")) {
            log.debug("No valid range header, treating as full request");
            return new DbWorldRecords.RangeInfo(0, false);
        }
        try {
            long start = Long.parseLong(header.substring(6).split("-")[0]);
            log.debug("Parsed range start: {}", start);
            return new DbWorldRecords.RangeInfo(start, true);
        } catch (Exception e) {
            log.error("Invalid range header: {}", header, e);
            throw new DbWorldException("Invalid Range header", e);
        }
    }

//    private HttpHeaders buildHeaders(String user, Path accelPath, Path realFile, DbWorldRecords.RangeInfo rangeInfo, boolean inline) {
//        log.debug("buildHeaders called: user={}, accelPath={}, realFile={}, rangeInfo={}, inline={}", user, accelPath, realFile, rangeInfo, inline);
//        try {
//            HttpHeaders headers = new HttpHeaders();
//            headers.add(HttpHeaders.ACCEPT_RANGES, "bytes");
//            headers.add("X-Accel-Redirect", buildAccelRedirectUrl(accelPath, user, rangeInfo.rangeStart(), inline));
//            headers.setContentType(dbWorldUtils.determineContentType(realFile));
//            headers.setContentDisposition(dbWorldUtils.createContentDisposition(realFile, inline));
//            log.debug("Final headers built for X-Accel-Redirect");
//            return headers;
//        } catch (Exception e) {
//            log.error("Failed to build headers", e);
//            throw new DbWorldException("Header build failed", e);
//        }
//    }

    private HttpHeaders buildHeaders(String user, Path accelPath, Path realFile, DbWorldRecords.RangeInfo rangeInfo, boolean inline) {
        log.debug("buildHeaders called: user={}, accelPath={}, realFile={}, rangeInfo={}, inline={}", user, accelPath, realFile, rangeInfo, inline);
        try {
            HttpHeaders headers = new HttpHeaders();

            headers.add(HttpHeaders.ACCEPT_RANGES, "bytes");

            String accelRedirect = buildAccelRedirectUrl(accelPath, user, rangeInfo.rangeStart(), inline);
            headers.add("X-Accel-Redirect", accelRedirect);

            MediaType contentType = dbWorldUtils.determineContentType(realFile);
            headers.setContentType(contentType);

            ContentDisposition contentDisposition = dbWorldUtils.createContentDisposition(realFile, inline);
            headers.setContentDisposition(contentDisposition);

            log.debug("Final headers built: X-Accel-Redirect={}, Content-Type={}, Content-Disposition={}",
                    accelRedirect, contentType, contentDisposition);
            return headers;
        } catch (Exception e) {
            log.error("Error building headers for user={}, file={}", user, realFile, e);
            throw new DbWorldException("Failed to build headers", e);
        }
    }

//    private String buildAccelRedirectUrl(Path path, String user, long rangeStart, boolean inline) {
//        log.debug("buildAccelRedirectUrl called: path={}, user={}, rangeStart={}, inline={}", path, user, rangeStart, inline);
//        try {
//            Path normalized = path.toAbsolutePath().normalize();
//            Path root = runtime.getSymlinkPath().toAbsolutePath().normalize();
//            String cleanPath = StringUtils.cleanPath(root.relativize(normalized).toString());
//            String requestId = UUID.randomUUID().toString();
//            String result = DbWorldConstants.CDN_STREAM_ID + cleanPath +
//                    "?userId=" + URLEncoder.encode(user, StandardCharsets.UTF_8) +
//                    "&rangeStart=" + rangeStart +
//                    "&downloadId=" + requestId +
//                    "&requestId=" + requestId +
//                    "&type=" + (inline ? DownloadType.STREAM : DownloadType.DOWNLOAD) +
//                    "&originalFile=" + URLEncoder.encode(normalized.toString(), StandardCharsets.UTF_8);
//            log.debug("Built redirect URL: {}", result);
//            return result;
//        } catch (Exception e) {
//            log.error("Failed to build accel redirect URL", e);
//            throw new DbWorldException("Accel redirect failed", e);
//        }
//    }

    private String buildAccelRedirectUrl(Path path, String user, long rangeStart, boolean inline) {
        log.debug("buildAccelRedirectUrl called: path={}, user={}, rangeStart={}, inline={}",
                path, user, rangeStart, inline);

        try {
            // Ensure path is absolute and normalized
            Path normalized = path.toAbsolutePath().normalize();
            Path symlinkRoot = runtime.getSymlinkPath().toAbsolutePath().normalize();
            Path streamRoot = runtime.getStreamPath().toAbsolutePath().normalize();
            Path externalRoot = runtime.getExternalVideosPath().toAbsolutePath().normalize();

            log.debug("Normalized path={}, symlinkRoot={}, streamRoot={}, externalRoot={}",
                    normalized, symlinkRoot, streamRoot, externalRoot);

            final String baseLocation;
            final Path relativePath;

            // ---------- ID-based (symlink) ----------
            if (normalized.startsWith(symlinkRoot)) {
                baseLocation = DbWorldConstants.CDN_STREAM_ID;
                relativePath = symlinkRoot.relativize(normalized);
                log.debug("ID-based streaming: baseLocation={}, relativePath={}", baseLocation, relativePath);
            }
            // ---------- PATH-based (legacy / direct) ----------
            else if (normalized.startsWith(streamRoot)) {
                baseLocation = DbWorldConstants.CDN_STREAM_PATH;
                relativePath = streamRoot.relativize(normalized);
                log.debug("Path-based streaming (internal): baseLocation={}, relativePath={}", baseLocation, relativePath);
            } else if (normalized.startsWith(externalRoot)) {
                baseLocation = DbWorldConstants.CDN_STREAM_PATH;
                relativePath = externalRoot.relativize(normalized);
                log.debug("Path-based streaming (external): baseLocation={}, relativePath={}", baseLocation, relativePath);
            } else {
                log.error("Path outside allowed media roots: normalized={}, allowedRoots=[{}, {}, {}]",
                        normalized, symlinkRoot, streamRoot, externalRoot);
                throw new IllegalArgumentException("Path outside allowed media roots: " + normalized);
            }

            String cleanPath = StringUtils.cleanPath(relativePath.toString());
            String encodedUser = URLEncoder.encode(user, StandardCharsets.UTF_8);
            String requestId = UUID.randomUUID().toString();
            String type = inline ? DownloadType.STREAM.toString() : DownloadType.DOWNLOAD.toString();

            // Build URL with proper encoding
            String result = baseLocation +
                    cleanPath +
                    "?userId=" + encodedUser +
                    "&rangeStart=" + rangeStart +
                    "&downloadId=" + requestId +
                    "&requestId=" + requestId +
                    "&type=" + type +
                    "&originalFile=" + URLEncoder.encode(normalized.toString(), StandardCharsets.UTF_8);
            log.debug("Built redirect URL: {}", result);
            return result;
        } catch (Exception e) {
            log.error("Error building redirect URL for path={}, user={}", path, user, e);
            throw new DbWorldException("Failed to build redirect URL", e);
        }
    }

    /* ========================= ACTIVITY ========================= */

    private void trackActivity(String user, Path file, long size, String range, boolean inline) {
        log.debug("trackActivity called: user={}, file={}, size={}, range={}, inline={}",
                user, file, size, range, inline);
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs == null) {
                log.warn("No request attributes found for activity tracking");
                return;
            }

            HttpServletRequest req = attrs.getRequest();
            String ip = dbWorldUtils.getClientIpAddress(req);
            String ua = req.getHeader("User-Agent");
            log.debug("Client info: ip={}, userAgent={}", ip, ua);

            if (inline) {
                log.debug("Tracking stream activity for user={}, file={}", user, file.getFileName());
                activityService.trackStreamActivity(user, file.toString(), file.getFileName().toString(), size, range, ip, ua);
            } else {
                log.debug("Tracking download activity for user={}, file={}", user, file.getFileName());
                activityService.trackDownloadActivity(user, file.toString(), file.getFileName().toString(), size, range, ip, ua);
            }
            log.debug("Activity tracked successfully for user={}", user);
        } catch (Exception e) {
            log.warn("Activity tracking failed for user={}", user, e);
        }
    }

    /* ========================= MEDIA INFO & DISCOVERY ========================= */
    @Override
    public List<DbWorldRecords.StreamableFileInfo> listRecursive(Path dir) {
        log.info("listRecursive called: dir={}", dir);
        if (!Files.isDirectory(dir)) {
            log.warn("Path is not a directory: {}", dir);
            return Collections.emptyList();
        }
        try (Stream<Path> stream = Files.walk(dir)) {
            List<DbWorldRecords.StreamableFileInfo> result = stream
                    .filter(Files::isRegularFile)
                    .map(this::buildDetails)
                    .collect(Collectors.toList());
            log.debug("Found {} files in directory {}", result.size(), dir);
            return result;
        } catch (IOException e) {
            log.error("Failed to list files in directory: {}", dir, e);
            throw new DbWorldException("Failed to list files in " + dir, e);
        }
    }

    @Override
    public List<DbWorldRecords.StreamableFileInfo> listAllStreamable() {
        log.info("listAllStreamable called");
        List<DbWorldRecords.StreamableFileInfo> list = new ArrayList<>();
        list.addAll(listRecursive(runtime.getStreamPath()));
        list.addAll(listRecursive(runtime.getExternalVideosPath()));
        log.info("Total streamable files found: {}", list.size());
        return list;
    }

    @Override
    public boolean matchesQuery(String fileName, String query) {
        log.debug("matchesQuery called: fileName={}, query={}", fileName, query);
        if (fileName == null || query == null) {
            log.debug("fileName or query is null, returning false");
            return false;
        }

        String normalizedFile = normalize(fileName);
        String normalizedQuery = normalize(query);
        log.trace("Normalized: fileName={}, query={}", normalizedFile, normalizedQuery);

        // Fast paths
        if (normalizedFile.contains(normalizedQuery)) {
            log.debug("Exact substring match found");
            return true;
        }
        if (isOrderedSubsequence(normalizedQuery, normalizedFile)) {
            log.debug("Ordered subsequence match found");
            return true;
        }

        // Token processing with early exit
        String[] queryTokens = normalizedQuery.split("\\s+");
        log.trace("Query tokens: {}", Arrays.toString(queryTokens));

        for (String token : queryTokens) {
            if (token.length() < 3 && !normalizedFile.contains(token)) {
                log.debug("Short token '{}' not found in fileName", token);
                return false;
            }
        }

        boolean allMatch = Arrays.stream(queryTokens)
                .parallel()
                .allMatch(token ->
                        normalizedFile.contains(token) ||
                                (token.length() >= 3 && containsNearMatchOptimized(normalizedFile, token))
                );
        log.debug("All tokens match: {}", allMatch);
        return allMatch;
    }

    private String normalize(String input) {
        log.trace("normalize called: input={}", input);
        return normalizedCache.computeIfAbsent(input, k -> {
            String noAccent = Normalizer.normalize(k, Normalizer.Form.NFD)
                    .replaceAll("\\p{M}", "");
            String result = noAccent
                    .toLowerCase()
                    .replaceAll("[^a-z0-9]", " ")
                    .replaceAll("\\s+", " ")
                    .trim();
            log.trace("Normalized result: {}", result);
            return result;
        });
    }

    private boolean isOrderedSubsequence(String query, String text) {
        log.trace("isOrderedSubsequence called: query={}, text={}", query, text);
        int q = 0;
        for (int t = 0; q < query.length() && t < text.length(); t++) {
            if (query.charAt(q) == text.charAt(t)) q++;
        }
        boolean result = q == query.length();
        log.trace("Ordered subsequence result: {}", result);
        return result;
    }

    private boolean containsNearMatchOptimized(String text, String token) {
        log.trace("containsNearMatchOptimized called: text={}, token={}", text, token);
        int tokenLen = token.length();

        // Check length ±1 substrings
        for (int windowSize = Math.max(3, tokenLen - 1);
             windowSize <= Math.min(text.length(), tokenLen + 1);
             windowSize++) {

            for (int i = 0; i <= text.length() - windowSize; i++) {
                if (levenshteinDistanceLeq1(
                        text.substring(i, i + windowSize),
                        token)) {
                    log.trace("Near match found at position {} with window size {}", i, windowSize);
                    return true;
                }
            }
        }
        log.trace("No near match found");
        return false;
    }

    private boolean levenshteinDistanceLeq1(String a, String b) {
        log.trace("levenshteinDistanceLeq1 called: a={}, b={}", a, b);
        int lenA = a.length(), lenB = b.length();
        int diff = Math.abs(lenA - lenB);

        if (diff > 1) {
            log.trace("Length difference > 1, returning false");
            return false;
        }

        if (diff == 1) {
            // Single insertion/deletion
            String shorter = lenA < lenB ? a : b;
            String longer = lenA < lenB ? b : a;

            for (int i = 0; i < longer.length(); i++) {
                if ((longer.substring(0, i) + longer.substring(i + 1)).equals(shorter)) {
                    log.trace("Single insertion/deletion match found");
                    return true;
                }
            }
            log.trace("No single insertion/deletion match");
            return false;
        }

        // Same length - check single substitution
        int mismatches = 0;
        for (int i = 0; i < lenA; i++) {
            if (a.charAt(i) != b.charAt(i)) {
                if (++mismatches > 1) {
                    log.trace("More than one mismatch, returning false");
                    return false;
                }
            }
        }
        boolean result = mismatches == 1;
        log.trace("Single substitution check: mismatches={}, result={}", mismatches, result);
        return result;
    }

    @Override
    public Optional<Path> resolvePathByFileId(String fileId) {
        log.info("resolvePathByFileId called: fileId={}", fileId);
        Optional<Path> result = listAllStreamable().stream()
                .filter(f -> f.fileId().equalsIgnoreCase(fileId))
                .map((info) -> Path.of(runtime.getStreamPath().toString(), StringUtils.cleanPath(info.filePath())))
                .findFirst();
        log.debug("Resolved path for fileId={}: {}", fileId, result.orElse(null));
        return result;
    }

    private Path resolvePath(DbWorldRecords.StreamableFileInfo info) {
        log.trace("resolvePath called: info.filePath={}", info.filePath());
        Path internal = runtime.getStreamPath().resolve(StringUtils.cleanPath(info.filePath()));
        if (Files.exists(internal)) {
            log.trace("File found in internal path: {}", internal);
            return internal;
        }
        Path external = runtime.getExternalVideosPath().resolve(StringUtils.cleanPath(info.filePath()));
        log.trace("File found in external path: {}", external);
        return external;
    }

    @Override
    public DbWorldRecords.StreamableFileInfo buildDetails(Path path) {
        log.debug("buildDetails called: path={}", path);
        try {
            long size = Files.size(path);
            String id = DigestUtils.md5DigestAsHex(path.toAbsolutePath().toString().getBytes(StandardCharsets.UTF_8));
            DbWorldRecords.StreamableFileInfo info = new DbWorldRecords.StreamableFileInfo(
                    path.getFileName().toString(),
                    toRelativePath(path),
                    false,
                    true,
                    size,
                    id
            );
            log.debug("Built file details: fileName={}, fileId={}, size={}", info.fileName(), info.fileId(), info.fileSize());
            return info;
        } catch (IOException e) {
            log.error("Failed to read file details: {}", path, e);
            throw new DbWorldException("Failed to read file details for " + path, e);
        }
    }

    private String toRelativePath(Path fullPath) {
        log.trace("toRelativePath called: fullPath={}", fullPath);
        String normalized = StringUtils.cleanPath(fullPath.toString());
        String streamRoot = StringUtils.cleanPath(runtime.getStreamPath().toString());
        String externalRoot = StringUtils.cleanPath(runtime.getExternalVideosPath().toString());

        String result;
        if (normalized.startsWith(streamRoot)) {
            result = normalized.substring(streamRoot.length());
        } else if (normalized.startsWith(externalRoot)) {
            result = normalized.substring(externalRoot.length());
        } else {
            result = fullPath.getFileName().toString();
        }

        // Ensure result starts with /
        if (!result.startsWith("/")) {
            result = "/" + result;
        }

        log.trace("Relative path result: {}", result);
        return result;
    }

    /* ========================= MEDIA INFO ========================= */

    @Override
    public List<MediaFileInfo> getMediaInfoByFileId(String fileId) {
        log.info("getMediaInfoByFileId called: fileId={}", fileId);
        try {
            Path realFile = resolvePathByFileId(fileId)
                    .orElseThrow(() -> {
                        log.error("File not found for fileId: {}", fileId);
                        return new DbWorldException("File not found for the fileId: " + fileId);
                    });
//            Path realFile = Path.of(runtime.getStreamPath().toString(),resolvedPath.toString());
            log.info("Running MediaInfo for fileId={} path={}", fileId, realFile);

            String json = processExecutor.runMediaInfoCommand(realFile);
            log.debug("MediaInfo JSON output length: {}", json.length());

            List<MediaFileInfo> result = parseMediaInfo(json);
            log.info("Successfully parsed MediaInfo for fileId={}, found {} media tracks", fileId, result.size());
            return result;
        } catch (Exception ex) {
            log.error("Failed to get media info for fileId={}", fileId, ex);
            throw new DbWorldException("Failed to get media info for fileId: " + fileId, ex);
        }
    }

    @Override
    public List<MediaFileInfo> parseMediaInfo(String jsonOutput) {
        log.debug("parseMediaInfo called, JSON length: {}", jsonOutput.length());
        try {
            JsonElement element = JsonParser.parseString(jsonOutput);
            List<MediaFileInfo> result = new ArrayList<>();
            if (element.isJsonArray()) {
                element.getAsJsonArray().forEach(e -> result.add(parseMediaInfoObject(e.getAsJsonObject())));
                log.debug("Parsed JSON array with {} elements", result.size());
            } else {
                result.add(parseMediaInfoObject(element.getAsJsonObject()));
                log.debug("Parsed single JSON object");
            }
            return result;
        } catch (Exception e) {
            log.error("Failed to parse MediaInfo output", e);
            throw new DbWorldException("Failed to parse MediaInfo output", e);
        }
    }

    private MediaFileInfo parseMediaInfoObject(JsonObject json) {
        log.trace("parseMediaInfoObject called");
        try {
            ObjectMapper mapper = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
            MediaFileInfo info = mapper.readValue(json.get("media").toString(), MediaFileInfo.class);
            info.initialize(runtime);
            log.trace("Successfully parsed MediaFileInfo: {}", info);
            return info;
        } catch (Exception e) {
            log.error("MediaInfo parsing error", e);
            throw new DbWorldException("MediaInfo parsing error", e);
        }
    }

}
