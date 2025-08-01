package com.db.dbworld.controllers;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.helpers.DbWorldRecords;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.dbcinema.stream.MediaFileInfo;
import com.db.dbworld.services.media.MediaFileInfoService;
import com.db.dbworld.services.media.StreamService;
import com.db.dbworld.services.user.UserService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.Semaphore;
import java.util.stream.Collectors;

@Log4j2
@RestController
@RequestMapping("/api/stream")
@CrossOrigin
public class StreamController {

    @Autowired private StreamService streamService;
    @Autowired private DbWorldUtils dbWorldUtils;
    @Autowired private UserService userService;
    @Autowired private MediaFileInfoService mediaFileInfoService;

    // Updated to use fileId as key
//    private final ConcurrentMap<String, Path> fileCache = new ConcurrentHashMap<>();
    private final Semaphore rateLimiter = new Semaphore(5);

    @GetMapping("/watch/{fileId}")
    public ResponseEntity<Void> watchFileOnline(@RequestHeader(value = "Range", required = false) String range,
                                                @PathVariable String fileId,
                                                @RequestParam("t") String token) {
        String user = userService.getUserFromToken(token);
        Path path = resolveFilePath(fileId);
        try {
            return streamService.streamFileByCdn(user, path, range, true);
        } catch (Exception e) {
            log.error("Error streaming file [{}] for user [{}]: {}", fileId, user, e.getMessage());
            throw e;
        }
    }

    @GetMapping("/download/{fileId}")
    public ResponseEntity<Void> downloadFile(@RequestHeader(value = "Range", required = false) String range,
                                             @PathVariable String fileId,
                                             @RequestParam("t") String token,
                                             @RequestParam(value = "inline", defaultValue = "false") boolean inline) throws IOException {
        String user = userService.getUserFromToken(token);
        Path path = resolveFilePath(fileId);
        acquirePermit();
        try {
            ResponseEntity<Void> response = streamService.streamFileByCdn(user, path, range, inline);
            if (range == null || range.isEmpty()) {
                log.info("User [{}] successfully downloaded file [{}] (full download)", user, fileId);
            } else {
                log.info("User [{}] is downloading partial content of file [{}], Range={}", user, fileId, range);
            }
            return response;
        } catch (Exception e) {
            log.error("Download failed for user [{}], file [{}]: {}", user, fileId, e.getMessage());
            throw e;
        } finally {
            rateLimiter.release();
        }
    }

    @GetMapping("/watch/uuid/{fileId}")
    public ResponseEntity<Void> watchFileByUUID(@RequestHeader(value = "Range", required = false) String range,
                                                @PathVariable String fileId,
                                                @RequestParam("t") String token) {
        String user = userService.getUserFromToken(token);
        Path path = Path.of(mediaFileInfoService.getFileInfoById(fileId));
//        log.info("User [{}] is streaming file by UUID [{}] at [{}], Range={}", user, fileId, path, range);
        if (!Files.exists(path)) {
            log.warn("File [{}] requested by [{}] does not exist", fileId, user);
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "File does not exist");
        }
        return streamService.streamFileByCdn(user, path, range, true);
    }

    @GetMapping("/download/uuid/{fileId}")
    public ResponseEntity<Void> downloadByUUID(@RequestHeader(value = "Range", required = false) String range,
                                               @PathVariable String fileId,
                                               @RequestParam("t") String token,
                                               @RequestParam(value = "inline", defaultValue = "false") boolean inline) throws IOException {
        String user = userService.getUserFromToken(token);
        Path path = Path.of(mediaFileInfoService.getFileInfoById(fileId));
//        log.info("User [{}] is downloading file by UUID [{}] at [{}], inline={}, Range={}", user, fileId, path, inline, range);
        if (!Files.exists(path)) {
            log.warn("UUID Download failed. File [{}] not found for user [{}]", fileId, user);
            throw new DbWorldException(HttpStatus.NOT_FOUND, "File not found");
        }
        acquirePermit();
        try {
            return streamService.streamFileByCdn(user, path, range, inline);
        } catch (Exception e) {
            log.error("UUID Download failed for user [{}], file [{}]: {}", user, fileId, e.getMessage());
            throw e;
        } finally {
            rateLimiter.release();
        }
    }

    @GetMapping("/media-info/{recordId}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    @Cacheable("media_info")
    public ApiResponse<List<MediaFileInfo>> getAllMediaInfoByRecordId(@PathVariable Long recordId) {
        log.info("User is requesting media info for record [{}]", recordId);
        return new ApiResponse<>(HttpStatus.OK, true, mediaFileInfoService.getAllFileInfoByRecordId(recordId));
    }

    @GetMapping("/media-info/file/{fileId}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    @Cacheable("media_info_file")
    public ApiResponse<List<MediaFileInfo>> getMediaInfoByFile(@PathVariable String fileId) {
        Path path = resolveFilePath(fileId);
        log.info("User is requesting media info for file [{}] at path [{}]", fileId, path);
        String json = dbWorldUtils.runMediaInfoCommand(path);
        return new ApiResponse<>(HttpStatus.OK, true, streamService.parseMediaInfo(json));
    }

    @GetMapping("/search")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<List<DbWorldRecords.StreamableFileInfo>> searchFiles(@Valid @NotEmpty @RequestParam("q") String query) {
        log.info("Searching streamable files for query: {}", query);
        List<DbWorldRecords.StreamableFileInfo> results = streamService.getAllStreamableFiles().stream()
                .filter(file -> streamService.matchesQuery(file.fileName(), query))
                .collect(Collectors.toList());
        log.info("Found {} results for query '{}'", results.size(), query);
        return new ApiResponse<>(HttpStatus.OK, true, results);
    }


    // -- Helpers --
    private Path resolveFilePath(String fileId) {
//        return fileCache.computeIfAbsent(fileId, id -> streamService.findFileById(id)
//                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "File not found")));
        return streamService.findFileById(fileId)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "File not found"));
    }

    private void acquirePermit() {
        if (!rateLimiter.tryAcquire()) {
            throw new DbWorldException(HttpStatus.TOO_MANY_REQUESTS, "Too many requests");
        }
    }

}