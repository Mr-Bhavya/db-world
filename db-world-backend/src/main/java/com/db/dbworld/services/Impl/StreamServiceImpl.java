package com.db.dbworld.services.Impl;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.services.StreamService;
import com.db.dbworld.utils.DbWorldConstants;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
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

    @Async
    @Override
    public CompletableFuture<ResponseEntity<InputStreamResource>> getStreamResource(Path path, String range) {

        final Long fileSize = getFileSize(path);
        long rangeStart = 0;
        long rangeEnd = Math.min(DbWorldConstants.CHUNK_SIZE, fileSize - 1);

        if (range == null) {
            return CompletableFuture.completedFuture(ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                    .header(HttpHeaders.TRANSFER_ENCODING, "chunked")
                    .header(DbWorldConstants.CONTENT_TYPE_HEADER, MediaType.APPLICATION_OCTET_STREAM_VALUE)
                    .header(DbWorldConstants.CONTENT_LENGTH_HEADER, String.valueOf(rangeEnd))
                    .header(DbWorldConstants.CONTENT_RANGE_HEADER, DbWorldConstants.BYTES + " " + rangeStart + "-" + rangeEnd + "/" + fileSize)
                    .body(readResource(path, rangeStart))); // Read the object and convert it as bytes
        }
        String[] ranges = range.split("-");
        rangeStart = Long.parseLong(ranges[0].substring(6));
        if (ranges.length > 1) {
            rangeEnd = Long.parseLong(ranges[1]);
        } else {
            rangeEnd = rangeStart + DbWorldConstants.CHUNK_SIZE;
        }

        rangeEnd = Math.min(rangeEnd, fileSize - 1);
        final String contentLength = String.valueOf((rangeEnd - rangeStart) + 1);
        HttpStatus httpStatus = HttpStatus.PARTIAL_CONTENT;
        if (rangeEnd >= fileSize) {
            httpStatus = HttpStatus.OK;
        }
        return CompletableFuture.completedFuture(ResponseEntity.status(httpStatus)
                .header(HttpHeaders.TRANSFER_ENCODING, "chunked")
                .header(DbWorldConstants.CONTENT_TYPE_HEADER, MediaType.APPLICATION_OCTET_STREAM_VALUE)
                .header(DbWorldConstants.CONTENT_LENGTH_HEADER, contentLength)
                .header(DbWorldConstants.CONTENT_RANGE_HEADER, DbWorldConstants.BYTES + " " + rangeStart + "-" + rangeEnd + "/" + fileSize)
                .body(readResource(path, rangeStart)));
    }

    @Override
    @Async
    public CompletableFuture<ResponseEntity<InputStreamResource>> getDownloadResource(Path path, String range) {
        final Long fileSize = getFileSize(path);
        long rangeStart = 0;
        long rangeEnd = (fileSize - 1);
        HttpStatusCode httpStatusCode = HttpStatus.OK;
        if (range != null) {
            String[] ranges = range.split("-");
            rangeStart = Long.parseLong(ranges[0].substring(6));
            httpStatusCode = HttpStatus.PARTIAL_CONTENT;
        }
        return CompletableFuture.completedFuture(ResponseEntity.status(httpStatusCode)
//                    .header(HttpHeaders.TRANSFER_ENCODING, "chunked")
                    .header(DbWorldConstants.ACCEPT_RANGES_HEADER, DbWorldConstants.BYTES)
                    .header(DbWorldConstants.CONTENT_TYPE_HEADER, MediaType.APPLICATION_OCTET_STREAM_VALUE)
//                    .header(DbWorldConstants.CONTENT_LENGTH_HEADER, String.valueOf(fileSize - rangeStart))
                    .header(DbWorldConstants.CONTENT_LENGTH_HEADER, String.valueOf(fileSize))
                    .header(DbWorldConstants.CONTENT_DISPOSITION_HEADER, getContentDisposition(path))
                    .header(DbWorldConstants.CONTENT_RANGE_HEADER, DbWorldConstants.BYTES + " " + rangeStart + "-" + rangeEnd + "/" + fileSize)
                    .body(readResource(path, rangeStart)));
    }

    @Override
//    @Cacheable(keyGenerator = DbWorldConstants.CUSTOM_REDIS_KEY_GENERATOR)
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
//    @Cacheable(keyGenerator = DbWorldConstants.CUSTOM_REDIS_KEY_GENERATOR)
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
//    @Cacheable(keyGenerator = DbWorldConstants.CUSTOM_REDIS_KEY_GENERATOR)
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

    public InputStreamResource readResource(Path path, long start) {
        InputStream inputStream = null;
        try {
            inputStream = Files.newInputStream(path);
            inputStream.skip(start);
        } catch (IOException e) {
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, e.getMessage());
        }
        InputStreamResource resource = new InputStreamResource(inputStream);
        return resource;
    }

    public String getContentDisposition(Path path) {
        return ContentDisposition.builder("attachment")
                .filename(path.getFileName().toString(), StandardCharsets.UTF_8)
                .build().toString();
    }

    public Long getFileSize(Path path) {
        try {
            return Files.size(path);
        } catch (IOException ioException) {
            log.error("Error while getting the file size. filepath: {}, Error: {}", path.toString(), ioException.getMessage());
        }
        return Math.round(Math.random());
    }

}
