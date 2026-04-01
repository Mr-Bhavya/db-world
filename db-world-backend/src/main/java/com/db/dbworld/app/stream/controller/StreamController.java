package com.db.dbworld.app.stream.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.media.info.dto.MediaFileDto;
import com.db.dbworld.app.media.info.service.MediaInfoService;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.helpers.DbWorldRecords;
import com.db.dbworld.security.auth.JwtService;
import com.db.dbworld.app.stream.service.StreamService;
import com.db.dbworld.utils.DbWorldConstants;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Collectors;

/**
 * REST endpoints for media file streaming and media-info lookup.
 * Migrated from com.db.dbworld.controllers.StreamController.
 *
 * Streaming: delegates to {@link StreamService} (still in use until a new streaming
 *   implementation is ready in app.media.stream.service).
 * Media-info: delegates to {@link MediaInfoService} (new app.media.info pipeline).
 */
@Log4j2
@RestController
@RequestMapping("/api/stream")
@RequiredArgsConstructor
public class StreamController {

    private final StreamService    streamService;
    private final JwtService       jwtService;
    private final MediaInfoService mediaInfoService;

    // ──────────────────────────────────────────────────────────────────────────
    // Streaming endpoints
    // ──────────────────────────────────────────────────────────────────────────

    @GetMapping("/watch/uuid/{fileId}")
    public Object watch(
            @RequestHeader(value = "Range", required = false) String range,
            @PathVariable String fileId,
            @RequestParam("t") String token) {

        String user = jwtService.parse(token).email();
        log.debug("stream watch uuid={} user={}", fileId, user);
        return streamService.streamById(user, fileId, range, true);
    }

    @GetMapping("/watch/{fileId}")
    public Object watchBySearch(
            @RequestHeader(value = "Range", required = false) String range,
            @PathVariable String fileId,
            @RequestParam("t") String token) {

        String user = jwtService.parse(token).email();
        Path path = streamService.resolvePathByFileId(fileId)
                .orElseThrow(() -> new DbWorldException("File not found for fileId: " + fileId));
        log.debug("stream watch by search fileId={} user={}", fileId, user);
        return streamService.streamByPath(user, path, range, true);
    }

    @GetMapping("/download/uuid/{fileId}")
    public Object download(
            @RequestHeader(value = "Range", required = false) String range,
            @PathVariable String fileId,
            @RequestParam("t") String token,
            @RequestParam(value = "inline", defaultValue = "false") boolean inline) {

        String user = jwtService.parse(token).email();
        log.debug("stream download uuid={} user={}", fileId, user);
        return streamService.streamById(user, fileId, range, inline);
    }

    @GetMapping("/download/{fileId}")
    public Object downloadBySearch(
            @RequestHeader(value = "Range", required = false) String range,
            @PathVariable String fileId,
            @RequestParam("t") String token,
            @RequestParam(value = "inline", defaultValue = "false") boolean inline) throws IOException {

        String user = jwtService.parse(token).email();
        Path path = streamService.resolvePathByFileId(fileId)
                .orElseThrow(() -> new DbWorldException("File not found for fileId: " + fileId));
        log.debug("stream download by search fileId={} user={}", fileId, user);
        return streamService.streamByPath(user, path, range, inline);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Media-info endpoints — now backed by the new MediaInfoService
    // ──────────────────────────────────────────────────────────────────────────

    @GetMapping("/media-info/{recordId}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<List<MediaFileDto>> getMediaInfoByRecord(@PathVariable Long recordId) {
        log.info("Fetching media info for recordId={}", recordId);
        return ApiResponse.success(mediaInfoService.getByRecordId(recordId));
    }

    @GetMapping("/media-info/file/{fileId}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<MediaFileDto> getMediaInfoByFile(@PathVariable String fileId) {
        return ApiResponse.success(
                mediaInfoService.getById(fileId)
                        .orElseThrow(() -> new DbWorldException("MediaFile not found: " + fileId)));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Search
    // ──────────────────────────────────────────────────────────────────────────

    @GetMapping("/search")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<List<DbWorldRecords.StreamableFileInfo>> search(
            @Valid @NotEmpty @RequestParam("q") String query) {

        log.info("Searching media query={}", query);
        List<DbWorldRecords.StreamableFileInfo> results = streamService.listAllStreamable()
                .stream()
                .filter(f -> streamService.matchesQuery(f.fileName(), query))
                .collect(Collectors.toList());
        return ApiResponse.success(results);
    }
}
