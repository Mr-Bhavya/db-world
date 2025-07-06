package com.db.dbworld.services.Impl;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.helpers.DbWorldRecords;
import com.db.dbworld.services.DownloadStatus;
import com.db.dbworld.services.StreamService;
import com.db.dbworld.services.UserService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.*;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

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
        // Validate inputs
        Objects.requireNonNull(user, "User cannot be null");
        Objects.requireNonNull(path, "Path cannot be null");

        final String downloadId = createDownloadId(user, path);
        final DbWorldRecords.FileSizeInfo sizeInfo = dbWorldUtils.getFileSizeInfo(path);
        final DbWorldRecords.RangeInfo rangeInfo = parseRangeHeader(rangeHeader, sizeInfo.fileSize());

        try {
            HttpHeaders headers = createResponseHeaders(user, path, sizeInfo, rangeInfo, inline, downloadId);

            // Ensure proper status code for range requests
            HttpStatus status = HttpStatus.OK;
            if (rangeHeader != null && rangeInfo.isPartial()) {
                status = HttpStatus.PARTIAL_CONTENT;
            }

            return new ResponseEntity<>(headers, status);
        } catch (Exception e) {
            log.error("Error during file streaming/download for {}: {}", path, e.getMessage());
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
                throw new DbWorldException("Invalid range start position");
            }

            return new DbWorldRecords.RangeInfo(start, start > 0);
        } catch (NumberFormatException e) {
            throw new DbWorldException("Invalid Range Header format", e);
        }
    }

    private HttpHeaders createResponseHeaders(String user, Path path, DbWorldRecords.FileSizeInfo sizeInfo, DbWorldRecords.RangeInfo rangeInfo,
                                              boolean inline, String downloadId) throws UnsupportedEncodingException {
        HttpHeaders headers = new HttpHeaders();

        // Set content length and range headers
        if (rangeInfo.isPartial()) {
            headers.set(HttpHeaders.CONTENT_RANGE,
                    String.format("bytes %d-%d/%d",
                            rangeInfo.rangeStart(),
                            sizeInfo.fileSize() - 1,
                            sizeInfo.fileSize()));
            headers.setContentLength(sizeInfo.fileSize() - rangeInfo.rangeStart());
        } else {
            headers.setContentLength(sizeInfo.fileSize());
        }

        // Set X-Accel-Redirect header
        headers.add("X-Accel-Redirect", buildAccelRedirectUrl(path, user, downloadId, rangeInfo.rangeStart(), inline));

        // Set content type
        headers.setContentType(dbWorldUtils.determineContentType(path));

        // Set content disposition
        headers.setContentDisposition(dbWorldUtils.createContentDisposition(path, inline));

        return headers;
    }

    private String buildAccelRedirectUrl(Path path, String user, String downloadId,
                                         long rangeStart, boolean inline) throws UnsupportedEncodingException {
        return String.format("/cdn/stream/%s?userId=%s&downloadId=%s&originalFile=%s&rangeStart=%d&requestId=%s&type=%s",
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
    public List<HashMap<String, Object>> getList(String path) {
        Path normalPath = Path.of(DbWorldConstants.STREAM_HOME_PATH + File.separator + path);
        Path externalDiskPath = Path.of(DbWorldConstants.EXTERNAL_STREAM_HOME_PATH + File.separator + path);
        List<Path> list = new ArrayList<>();
        try {
            if (path == null || path.isEmpty()) {
                list.addAll(Files.list(normalPath).toList());
                if (Files.exists(externalDiskPath))
                    list.addAll(Files.list(externalDiskPath).toList());
                else
                    log.warn("External Disk Stream Path is ignored.");
            } else {
                if (Files.exists(normalPath)) {
                    list.addAll(Files.list(normalPath).toList());
                } else if (Files.exists(externalDiskPath)) {
                    list.addAll(Files.list(externalDiskPath).toList());
                } else {
                    list.addAll(Files.list(Path.of(DbWorldConstants.STREAM_HOME_PATH)).toList());
                }
            }
            return list.stream().map(this::createDetails).collect(Collectors.toList());
        } catch (IOException e) {
            throw new DbWorldException(e.toString());
        }
    }

    @Override
    public ArrayList<File> getListRecursive(Path dir) {
        ArrayList<File> files = new ArrayList<>();
        if (Files.exists(dir) && Files.isDirectory(dir)) {
            Arrays.stream(Objects.requireNonNull(dir.toFile().listFiles())).forEach(file -> {
                if (file.isDirectory()) {
                    files.addAll(getListRecursive(file.toPath()));
                } else {
                    files.add(file);
                }
            });
        }
        return files;
    }

    @Override
    public HashMap<String, Object> createDetails(Path path) {
        HashMap<String, Object> hashMap = new LinkedHashMap<>();
        try {
            hashMap.put("fileName", path.toFile().getName());
            hashMap.put("filePath", path.toFile().getPath().replace("\\", "/")
                    .replace(DbWorldConstants.STREAM_HOME_PATH, "")
                    .replace(DbWorldConstants.EXTERNAL_STREAM_HOME_PATH, ""));
            hashMap.put("isDirectory", path.toFile().isDirectory());
            hashMap.put("isFile", path.toFile().isFile());
            hashMap.put("fileSize", Files.size(path));
            hashMap.put("isFTP", false);
            hashMap.put("fileId", Files.size(path));
        } catch (IOException e) {
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, e.getMessage());
        }
        return hashMap;
    }

}
