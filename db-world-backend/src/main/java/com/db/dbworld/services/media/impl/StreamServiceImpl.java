package com.db.dbworld.services.media.impl;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.helpers.DbWorldRecords;
import com.db.dbworld.payloads.dbcinema.stream.MediaFileInfo;
import com.db.dbworld.services.DownloadType;
import com.db.dbworld.services.media.StreamService;
import com.db.dbworld.services.user.UserCinemaActivityService;
import com.db.dbworld.utils.DbWorldRuntimeProperties;
import com.db.dbworld.utils.DbWorldUtils;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.*;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.log4j.Log4j2;
import org.springframework.cache.annotation.CacheConfig;
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
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@Log4j2
@Transactional
@CacheConfig(cacheNames = "DB-Stream")
public class StreamServiceImpl implements StreamService {

    private final DbWorldRuntimeProperties runtime;
    private final DbWorldUtils dbWorldUtils;
    private final UserCinemaActivityService userCinemaActivityService;

    public StreamServiceImpl(
            DbWorldRuntimeProperties runtime,
            DbWorldUtils dbWorldUtils,
            UserCinemaActivityService userCinemaActivityService,
            DbWorldRuntimeProperties runtimeProperties
    ) {
        this.runtime = runtime;
        this.dbWorldUtils = dbWorldUtils;
        this.userCinemaActivityService = userCinemaActivityService;
    }

    /* =========================================================
       Streaming
       ========================================================= */

    @Override
    public ResponseEntity<Void> streamFileByCdn(
            String user,
            Path path,
            String rangeHeader,
            boolean inline
    ) {

        Objects.requireNonNull(user, "User cannot be null");
        Objects.requireNonNull(path, "Path cannot be null");

        DbWorldRecords.FileSizeInfo sizeInfo =
                dbWorldUtils.getFileSizeInfo(path);

        DbWorldRecords.RangeInfo rangeInfo =
                parseRangeHeader(rangeHeader, sizeInfo.fileSize());

        try {
            HttpHeaders headers = createResponseHeaders(
                    user, path, sizeInfo, rangeInfo, inline, ""
            );

            HttpStatus status =
                    rangeHeader != null && rangeInfo.isPartial()
                            ? HttpStatus.PARTIAL_CONTENT
                            : HttpStatus.OK;

            if (inline) {
                trackStreamActivityAsync(
                        user, path.toString(), path.getFileName().toString(),
                        sizeInfo.fileSize(), rangeHeader
                );
            } else {
                trackDownloadActivityAsync(
                        user, path.toString(), path.getFileName().toString(),
                        sizeInfo.fileSize(), rangeHeader
                );
            }

            return new ResponseEntity<>(headers, status);

        } catch (Exception e) {
            log.error("Streaming error for file {}", path, e);
            throw new DbWorldException("Error during file streaming", e);
        }
    }

    /* =========================================================
       Activity Tracking
       ========================================================= */

    private void trackStreamActivityAsync(
            String user,
            String filePath,
            String fileName,
            Long fileSize,
            String rangeHeader
    ) {
        trackActivity(
                user, filePath, fileName, fileSize, rangeHeader, true
        );
    }

    private void trackDownloadActivityAsync(
            String user,
            String filePath,
            String fileName,
            Long fileSize,
            String rangeHeader
    ) {
        trackActivity(
                user, filePath, fileName, fileSize, rangeHeader, false
        );
    }

    private void trackActivity(
            String user,
            String filePath,
            String fileName,
            Long fileSize,
            String rangeHeader,
            boolean stream
    ) {
        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();

            if (attrs == null) {
                return;
            }

            HttpServletRequest request = attrs.getRequest();
            String ip = dbWorldUtils.getClientIpAddress(request);
            String ua = request.getHeader("User-Agent");

            if (stream) {
                userCinemaActivityService.trackStreamActivity(
                        user, filePath, fileName, fileSize,
                        rangeHeader, ip, ua
                );
            } else {
                userCinemaActivityService.trackDownloadActivity(
                        user, filePath, fileName, fileSize,
                        rangeHeader, ip, ua
                );
            }

        } catch (Exception e) {
            log.warn("Failed to track activity for {}", user, e);
        }
    }

    /* =========================================================
       Range Handling
       ========================================================= */

    private DbWorldRecords.RangeInfo parseRangeHeader(
            String rangeHeader,
            long fileSize
    ) {

        if (rangeHeader == null || !rangeHeader.startsWith("bytes=")) {
            return new DbWorldRecords.RangeInfo(0, false);
        }

        try {
            long start = Long.parseLong(
                    rangeHeader.substring(6).split("-")[0].trim()
            );

            if (start < 0 || start >= fileSize) {
                throw new DbWorldException("Invalid range start");
            }

            return new DbWorldRecords.RangeInfo(start, start > 0);

        } catch (Exception e) {
            throw new DbWorldException("Invalid Range Header", e);
        }
    }

    /* =========================================================
       Headers
       ========================================================= */

    private HttpHeaders createResponseHeaders(
            String user,
            Path path,
            DbWorldRecords.FileSizeInfo sizeInfo,
            DbWorldRecords.RangeInfo rangeInfo,
            boolean inline,
            String downloadId
    ) {

        HttpHeaders headers = new HttpHeaders();

        if (rangeInfo.isPartial()) {
            headers.set(HttpHeaders.CONTENT_RANGE,
                    "bytes " + rangeInfo.rangeStart() + "-" +
                            (sizeInfo.fileSize() - 1) + "/" +
                            sizeInfo.fileSize()
            );
            headers.setContentLength(sizeInfo.fileSize() - rangeInfo.rangeStart());
        } else {
            headers.setContentLength(sizeInfo.fileSize());
        }

        headers.add(
                "X-Accel-Redirect",
                buildAccelRedirectUrl(
                        path, user, downloadId,
                        rangeInfo.rangeStart(), inline
                )
        );

        MediaType type = dbWorldUtils.determineContentType(path);
        headers.setContentType(type);
        headers.setContentDisposition(
                dbWorldUtils.createContentDisposition(path, inline)
        );

        return headers;
    }

    private String buildAccelRedirectUrl(
            Path path,
            String user,
            String downloadId,
            long rangeStart,
            boolean inline
    ) {

        return "/cdn/stream" + path +
                "?userId=" + URLEncoder.encode(user, StandardCharsets.UTF_8) +
                "&downloadId=" + URLEncoder.encode(downloadId, StandardCharsets.UTF_8) +
                "&originalFile=" + URLEncoder.encode(path.toString(), StandardCharsets.UTF_8) +
                "&rangeStart=" + rangeStart +
                "&requestId=" + UUID.randomUUID() +
                "&type=" + (inline ? DownloadType.STREAM : DownloadType.DOWNLOAD);
    }

    /* =========================================================
       File Listing
       ========================================================= */

    @Override
    public List<DbWorldRecords.StreamableFileInfo> getListRecursive(Path dir) {
        if (!Files.isDirectory(dir)) {
            return Collections.emptyList();
        }

        try (Stream<Path> stream = Files.walk(dir)) {
            return stream
                    .filter(Files::isRegularFile)
                    .map(this::createDetails)
                    .collect(Collectors.toList());
        } catch (IOException e) {
            throw new DbWorldException("Failed to list files", e);
        }
    }

    @Override
    public List<DbWorldRecords.StreamableFileInfo> getAllStreamableFiles() {
        List<DbWorldRecords.StreamableFileInfo> list = new ArrayList<>();
        list.addAll(getListRecursive(runtime.getStreamPath()));
        list.addAll(getListRecursive(runtime.getExternalVideosPath()));
        return list;
    }

    @Override
    public boolean matchesQuery(String fileName, String query) {
        fileName = fileName.toLowerCase().replaceAll("[._]", " ");
        String[] tokens = query.toLowerCase().split("\\s+");
        return Arrays.stream(tokens).allMatch(fileName::contains);
    }

    @Override
    public Optional<Path> findFileById(String fileId) {
        List<DbWorldRecords.StreamableFileInfo> allFiles = getAllStreamableFiles();
        return allFiles.stream()
                .filter(file -> file.fileId().equalsIgnoreCase(fileId))
                .map(this::resolvePath)
                .findFirst();
    }

    /* =========================================================
       Path Handling (NO resolve)
       ========================================================= */

    private String toRelativePath(Path fullPath) {

        String normalized = StringUtils.cleanPath(fullPath.toString());

        String streamRoot =
                StringUtils.cleanPath(runtime.getStreamPath().toString());
        String externalRoot =
                StringUtils.cleanPath(runtime.getExternalVideosPath().toString());

        if (normalized.startsWith(streamRoot)) {
            return normalized.substring(streamRoot.length());
        }
        if (normalized.startsWith(externalRoot)) {
            return normalized.substring(externalRoot.length());
        }

        return fullPath.getFileName().toString();
    }

    private Path resolvePath(DbWorldRecords.StreamableFileInfo info) {

        String relative = StringUtils.cleanPath(info.filePath());

        Path internal = Path.of(
                StringUtils.cleanPath(runtime.getStreamPath().toString()),
                relative
        );

        if (Files.exists(internal)) {
            return internal;
        }

        return Path.of(
                StringUtils.cleanPath(runtime.getExternalVideosPath().toString()),
                relative
        );
    }

    /* =========================================================
       File Info
       ========================================================= */

    @Override
    public DbWorldRecords.StreamableFileInfo createDetails(Path path) {
        try {
            long size = Files.size(path);
            String fileId = DigestUtils.md5DigestAsHex(
                    path.toAbsolutePath().toString().getBytes()
            );

            return new DbWorldRecords.StreamableFileInfo(
                    path.getFileName().toString(),
                    toRelativePath(path),
                    false,
                    true,
                    size,
                    fileId
            );

        } catch (IOException e) {
            throw new DbWorldException("Failed to create file details", e);
        }
    }

    /* =========================================================
       MediaInfo Parsing (unchanged)
       ========================================================= */

    @Override
    public List<MediaFileInfo> parseMediaInfo(String jsonOutput) {
        try {
            List<MediaFileInfo> result = new ArrayList<>();
            JsonElement element = JsonParser.parseString(jsonOutput);

            if (element.isJsonArray()) {
                for (JsonElement e : element.getAsJsonArray()) {
                    result.add(convertJsonObjectToMediaInfo(e.getAsJsonObject()));
                }
            } else {
                result.add(convertJsonObjectToMediaInfo(element.getAsJsonObject()));
            }

            return result;

        } catch (Exception e) {
            throw new DbWorldException("Failed to parse media info", e);
        }
    }

    private MediaFileInfo convertJsonObjectToMediaInfo(JsonObject json)
            throws IOException {

        ObjectMapper mapper = new ObjectMapper()
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        MediaFileInfo info =
                mapper.readValue(json.get("media").toString(), MediaFileInfo.class);

        info.initialize(runtime);
        return info;
    }
}
