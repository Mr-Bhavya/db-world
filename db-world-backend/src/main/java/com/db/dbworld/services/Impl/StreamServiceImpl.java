package com.db.dbworld.services.Impl;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.helpers.DbWorldRecords;
import com.db.dbworld.payloads.dbcinema.stream.MediaFileInfo;
import com.db.dbworld.payloads.dbcinema.stream.TrackInfo;
import com.db.dbworld.services.DownloadStatus;
import com.db.dbworld.services.media.StreamService;
import com.db.dbworld.services.user.UserService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.*;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.core.io.ResourceLoader;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.DigestUtils;

import java.io.*;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@Log4j2
@CacheConfig(cacheNames = "DB-Stream")
public class StreamServiceImpl implements StreamService {

    @Autowired
    private ResourceLoader resourceLoader;

    @Autowired
    private UserService userService;

    @Autowired
    private DbWorldUtils dbWorldUtils;

    @Override
    public ResponseEntity<Void> streamFileByCdn(String user, Path path, String rangeHeader, boolean inline) {
        Objects.requireNonNull(user, "User cannot be null");
        Objects.requireNonNull(path, "Path cannot be null");

        final String downloadId = createDownloadId(user, path);
        log.info("Start streaming: user={}, file={}, rangeHeader={}, inline={}", user, path, rangeHeader, inline);

        final DbWorldRecords.FileSizeInfo sizeInfo = dbWorldUtils.getFileSizeInfo(path);
        final DbWorldRecords.RangeInfo rangeInfo = parseRangeHeader(rangeHeader, sizeInfo.fileSize());

        try {
            HttpHeaders headers = createResponseHeaders(user, path, sizeInfo, rangeInfo, inline, downloadId);

            HttpStatus status = HttpStatus.OK;
            if (rangeHeader != null && rangeInfo.isPartial()) {
                status = HttpStatus.PARTIAL_CONTENT;
                log.debug("Partial content requested: rangeStart={}, fileSize={}", rangeInfo.rangeStart(), sizeInfo.fileSize());
            }

            log.info("Streaming response ready: status={}, X-Accel-Redirect={}", status, headers.getFirst("X-Accel-Redirect"));
            return new ResponseEntity<>(headers, status);
        } catch (Exception e) {
            log.error("Streaming error for file {}: {}", path, e.getMessage(), e);
            throw new DbWorldException("Error during file streaming/download", e);
        }
    }


    private String createDownloadId(String user, Path path) {
        return user + "-" + path.getFileName();
    }


    private DbWorldRecords.RangeInfo parseRangeHeader(String rangeHeader, long fileSize) {
        if (rangeHeader == null || !rangeHeader.startsWith("bytes=")) {
            return new DbWorldRecords.RangeInfo(0, false);
        }

        try {
            String rangeValue = rangeHeader.substring(6).trim();
            long start = Long.parseLong(rangeValue.split("-")[0].trim());

            if (start < 0 || start >= fileSize) {
                log.warn("Invalid range start: {} (fileSize={})", start, fileSize);
                throw new DbWorldException("Invalid range start position");
            }

            return new DbWorldRecords.RangeInfo(start, start > 0);
        } catch (NumberFormatException e) {
            log.warn("Failed to parse range header: {}", rangeHeader, e);
            throw new DbWorldException("Invalid Range Header format", e);
        }
    }


    private HttpHeaders createResponseHeaders(String user, Path path, DbWorldRecords.FileSizeInfo sizeInfo,
                                              DbWorldRecords.RangeInfo rangeInfo, boolean inline, String downloadId) throws UnsupportedEncodingException {
        HttpHeaders headers = new HttpHeaders();

        headers.add("X-Accel-Charset", "utf-8");

        if (rangeInfo.isPartial()) {
            headers.set(HttpHeaders.CONTENT_RANGE,
                    String.format("bytes %d-%d/%d", rangeInfo.rangeStart(), sizeInfo.fileSize() - 1, sizeInfo.fileSize()));
            headers.setContentLength(sizeInfo.fileSize() - rangeInfo.rangeStart());
            headers.add("X-Accel-Content-Length", String.valueOf(sizeInfo.fileSize() - rangeInfo.rangeStart()));
        } else {
            headers.setContentLength(sizeInfo.fileSize());
            headers.add("X-Accel-Content-Length", String.valueOf(sizeInfo.fileSize()));
        }

        String redirectUrl = buildAccelRedirectUrl(path, user, downloadId, rangeInfo.rangeStart(), inline);
        headers.add("X-Accel-Redirect", redirectUrl);
        log.debug("Accel redirect: {}", redirectUrl);

        headers.setContentType(dbWorldUtils.determineContentType(path));
        headers.add("X-Accel-Content-Type", dbWorldUtils.determineContentType(path).toString());

        ContentDisposition contentDisposition = dbWorldUtils.createContentDisposition(path, inline);
        headers.setContentDisposition(contentDisposition);
        headers.add("X-Accel-Content-Disposition", contentDisposition.toString());

        return headers;
    }


    private String buildAccelRedirectUrl(Path path, String user, String downloadId,
                                         long rangeStart, boolean inline) throws UnsupportedEncodingException {
        return String.format("/cdn/stream%s?userId=%s&downloadId=%s&originalFile=%s&rangeStart=%d&requestId=%s&type=%s",
                path,
                URLEncoder.encode(user, StandardCharsets.UTF_8),
                URLEncoder.encode(downloadId, StandardCharsets.UTF_8),
                URLEncoder.encode(path.toString(), StandardCharsets.UTF_8),
                rangeStart,
                UUID.randomUUID(),
                inline ? DownloadStatus.DownloadType.STREAM : DownloadStatus.DownloadType.DOWNLOAD
        );
    }

    @Override
    public List<DbWorldRecords.StreamableFileInfo> getListRecursive(Path dir) {
        if (!Files.isDirectory(dir)) {
            log.warn("Path is not a directory: {}", dir);
            return Collections.emptyList();
        }

        try (Stream<Path> stream = Files.walk(dir)) {
            List<DbWorldRecords.StreamableFileInfo> result = stream
                    .filter(Files::isRegularFile)
                    .map(this::createDetails)
                    .collect(Collectors.toList());
            log.info("Found {} files in directory {}", result.size(), dir);
            return result;
        } catch (IOException e) {
            log.error("Error while listing files in directory: {}", dir, e);
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to list files: " + e.getMessage());
        }
    }

    @Override
    public List<DbWorldRecords.StreamableFileInfo> getAllStreamableFiles() {
        List<DbWorldRecords.StreamableFileInfo> list = new ArrayList<>();
        list.addAll(getListRecursive(Path.of(DbWorldConstants.STREAM_HOME_PATH)));
//        list.addAll(getListRecursive(Path.of(DbWorldConstants.EXTERNAL_STREAM_HOME_PATH)));
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

    private Path resolvePath(DbWorldRecords.StreamableFileInfo info) {
        String pathStr = info.filePath();
        if (Files.exists(Path.of(DbWorldConstants.STREAM_HOME_PATH, pathStr))) {
            return Path.of(DbWorldConstants.STREAM_HOME_PATH, pathStr);
        } else {
            return Path.of(DbWorldConstants.EXTERNAL_STREAM_HOME_PATH, pathStr);
        }
    }


    @Override
    public DbWorldRecords.StreamableFileInfo createDetails(Path path) {
        try {
            long fileSize = Files.size(path);
            String fileId = DigestUtils.md5DigestAsHex(path.toAbsolutePath().toString().getBytes());

            String relativePath = path.toString()
                    .replace("\\", "/")
                    .replace(DbWorldConstants.STREAM_HOME_PATH, "")
                    .replace(DbWorldConstants.EXTERNAL_STREAM_HOME_PATH, "")
                    ;

            return new DbWorldRecords.StreamableFileInfo(
                    path.getFileName().toString(),
                    relativePath,
                    Files.isDirectory(path),
                    Files.isRegularFile(path),
                    fileSize,
                    fileId
            );

        } catch (IOException e) {
            log.error("Failed to create file details for: {}", path, e);
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to get file details");
        }
    }


    @Override
    public List<MediaFileInfo> parseMediaInfo(String jsonOutput) {
        try {
            List<MediaFileInfo> mediaFileInfos = new ArrayList<>();
            JsonElement jsonElement = new Gson().fromJson(jsonOutput, JsonElement.class);

            if (jsonElement.isJsonArray()) {
                log.debug("Parsing JSON array for media info");
                jsonElement.getAsJsonArray().forEach(element -> {
                    try {
                        mediaFileInfos.add(convertJsonObjectToMediaInfo(element.getAsJsonObject()));
                    } catch (IOException e) {
                        throw new DbWorldException(e.getMessage());
                    }
                });
            } else if (jsonElement.isJsonObject()) {
                log.debug("Parsing single JSON object for media info");
                mediaFileInfos.add(convertJsonObjectToMediaInfo(jsonElement.getAsJsonObject()));
            }

            log.info("Parsed {} media file(s) from JSON", mediaFileInfos.size());
            return mediaFileInfos;
        } catch (Exception ex) {
            log.error("Error parsing media info JSON: {}", ex.getMessage(), ex);
            throw new DbWorldException(ex.getMessage());
        }
    }


    private MediaFileInfo convertJsonObjectToMediaInfo(JsonObject jsonObject) throws IOException {
        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        MediaFileInfo mediaFileInfo = objectMapper.readValue(jsonObject.get("media").toString(), MediaFileInfo.class);
        mediaFileInfo.initialize();
        if (mediaFileInfo == null) {
            throw new DbWorldException("Media file details could not be retrieved from JSON");
        }
        return mediaFileInfo;
    }

    private MediaFileInfo convertToMediaInfo(JsonElement element) {
        try {
            JsonObject media = element.getAsJsonObject().getAsJsonObject("media");

            MediaFileInfo info = new MediaFileInfo();
            info.setFilePath(media.get("@ref").getAsString());

            JsonArray tracks = media.getAsJsonArray("track");
            List<TrackInfo> trackInfos = new ArrayList<>();
            for (JsonElement trackElem : tracks) {
                TrackInfo track = new Gson().fromJson(trackElem, TrackInfo.class);
                trackInfos.add(track);
            }
            info.setTrackInfos(trackInfos);
            info.initialize(); // extract fileName, fileSize from "General"

            return info;
        } catch (Exception e) {
            log.error("Failed to convert media info JSON: {}", e.getMessage(), e);
            throw new DbWorldException("Failed to convert media info: " + e.getMessage());
        }
    }

}
