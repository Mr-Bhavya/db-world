package com.db.dbworld.controllers;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.exceptions.ProcessExecutionException;
import com.db.dbworld.helpers.DbWorldRecords;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.dbcinema.stream.MediaFileInfo;
import com.db.dbworld.services.media.MediaFileInfoService;
import com.db.dbworld.services.media.StreamService;
import com.db.dbworld.services.user.UserService;
import com.db.dbworld.utils.DbWorldConstants;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.extern.log4j.Log4j2;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.Semaphore;
import java.util.stream.Collectors;

@Log4j2
@RestController
@RequestMapping("/api/stream")
@CrossOrigin
public class StreamController {

    private final StreamService streamService;
    private final UserService userService;
    private final MediaFileInfoService mediaFileInfoService;
    private final Semaphore rateLimiter = new Semaphore(5, true);

    public StreamController(StreamService streamService, UserService userService, MediaFileInfoService mediaFileInfoService) {
        this.streamService = streamService;
        this.userService = userService;
        this.mediaFileInfoService = mediaFileInfoService;
    }

    @GetMapping("/watch/uuid/{fileId}")
    public Object watch(@RequestHeader(value = "Range", required = false) String range, @PathVariable String fileId, @RequestParam("t") String token) {
        String user = userService.getUserFromToken(token);
        log.debug("Streaming watch uuid={} user={}", fileId, user);
        return streamService.streamById(user, fileId, range, true);
    }

    @GetMapping("/watch/{fileId}")
    public Object watchBySearch(@RequestHeader(value = "Range", required = false) String range, @PathVariable String fileId, @RequestParam("t") String token) {
        String user = userService.getUserFromToken(token);
        Path path = streamService.resolvePathByFileId(fileId).orElseThrow(() -> new DbWorldException("File not found for fileId: " + fileId));
        log.debug("Streaming watch by search fileId={} user={}", fileId, user);
        return streamService.streamByPath(user, path, range, true);
    }

    @GetMapping("/download/uuid/{fileId}")
    public Object download(@RequestHeader(value = "Range", required = false) String range, @PathVariable String fileId, @RequestParam("t") String token, @RequestParam(value = "inline", defaultValue = "false") boolean inline) {
        String user = userService.getUserFromToken(token);
        log.debug("Streaming download uuid={} user={}", fileId, user);
        return streamService.streamById(user, fileId, range, inline);
    }

    @GetMapping("/download/{fileId}")
    public Object downloadBySearch(@RequestHeader(value = "Range", required = false) String range, @PathVariable String fileId, @RequestParam("t") String token, @RequestParam(value = "inline", defaultValue = "false") boolean inline) throws IOException {
        String user = userService.getUserFromToken(token);
        Path path = streamService.resolvePathByFileId(fileId).orElseThrow(() -> new DbWorldException("File not found for fileId: " + fileId));
        log.debug("Streaming download by search fileId={} user={}", fileId, user);
        return streamService.streamByPath(user, path, range, inline);
    }

    @GetMapping("/media-info/{recordId}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<List<MediaFileInfo>> getMediaInfoByRecord(@PathVariable Long recordId) {
        log.info("Fetching media info for recordId={}", recordId);
        return ApiResponse.success(mediaFileInfoService.getAllFileInfoByRecordId(recordId));
    }

    @GetMapping("/media-info/file/{fileId}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<List<MediaFileInfo>> getMediaInfoByFile(@PathVariable String fileId) throws ProcessExecutionException {
        return ApiResponse.success(streamService.getMediaInfoByFileId(fileId));
    }

    @GetMapping("/search")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<List<DbWorldRecords.StreamableFileInfo>> search(@Valid @NotEmpty @RequestParam("q") String query) {
        log.info("Searching media for query={}", query);
        List<DbWorldRecords.StreamableFileInfo> results = streamService.listAllStreamable().stream().filter(f -> streamService.matchesQuery(f.fileName(), query)).collect(Collectors.toList());
        return ApiResponse.success(results);
    }

    private void acquirePermit() {
        if (!rateLimiter.tryAcquire()) {
            throw new DbWorldException("Too many concurrent downloads");
        }
    }
}
