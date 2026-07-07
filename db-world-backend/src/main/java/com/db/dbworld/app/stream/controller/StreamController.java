package com.db.dbworld.app.stream.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.media.info.dto.MediaFileDto;
import com.db.dbworld.app.media.info.service.MediaInfoService;
import com.db.dbworld.app.stream.dto.CdnResolveDto;
import com.db.dbworld.app.stream.dto.ResolveBatchRequest;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.helpers.DbWorldRecords;
import com.db.dbworld.app.stream.service.StreamService;
import com.db.dbworld.config.AppConstants;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Path;
import java.util.List;
import java.util.stream.Collectors;

@Log4j2
@RestController
@RequestMapping("/api/stream")
@RequiredArgsConstructor
public class StreamController {

    private final StreamService          streamService;
    private final UserContext            userContext;
    private final MediaInfoService       mediaInfoService;

    // CDN URL resolve â€” returns JSON with CDN URL + metadata
    // Client embeds cdnUrl directly in <video src> or <a href>.
    // Authenticated via the standard Authorization: Bearer header (like every other API);
    // the CDN URL itself is protected by nginx secure_link signing, not this JWT.
    // type: ONLINE (inline/stream) | DOWNLOAD (attachment)

    @GetMapping("/resolve/{mediaFileId}")
    @PreAuthorize(AppConstants.ALL_AUTHORIZE)
    public ApiResponse<CdnResolveDto> resolveById(
            @PathVariable String mediaFileId,
            @RequestParam(value = "type", defaultValue = "ONLINE") String type,
            HttpServletRequest request) {

        String user = userContext.email();
        boolean inline = !"DOWNLOAD".equalsIgnoreCase(type);
        log.info("resolve id={} user={} type={}", mediaFileId, user, type);
        CdnResolveDto dto = streamService.resolveById(
                user, mediaFileId, inline,
                request.getHeader("User-Agent"),
                getClientIp(request));
        return ApiResponse.success(dto);
    }

    // Batch resolve — one round-trip for all quality variants of a title (kills the client N+1).
    @PostMapping("/resolve-batch")
    @PreAuthorize(AppConstants.ALL_AUTHORIZE)
    public ApiResponse<List<CdnResolveDto>> resolveBatch(
            @RequestBody ResolveBatchRequest body,
            HttpServletRequest request) {

        String user = userContext.email();
        boolean inline = body.type() == null || !"DOWNLOAD".equalsIgnoreCase(body.type());
        List<String> ids = body.mediaFileIds();
        log.info("resolve-batch user={} count={} type={}", user, ids != null ? ids.size() : 0, body.type());
        List<CdnResolveDto> dtos = streamService.resolveBatch(
                user, ids, inline,
                request.getHeader("User-Agent"),
                getClientIp(request));
        return ApiResponse.success(dtos);
    }

    @GetMapping("/resolve")
    @PreAuthorize(AppConstants.ALL_AUTHORIZE)
    public ApiResponse<CdnResolveDto> resolveByPath(
            @RequestParam("path") String path,
            @RequestParam(value = "type", defaultValue = "ONLINE") String type,
            HttpServletRequest request) {

        String user = userContext.email();
        boolean inline = !"DOWNLOAD".equalsIgnoreCase(type);
        log.info("resolve path={} user={} type={}", path, user, type);
        CdnResolveDto dto = streamService.resolveByPath(
                user, path, inline,
                request.getHeader("User-Agent"),
                getClientIp(request));
        return ApiResponse.success(dto);
    }

    @GetMapping("/media-info/{recordId}")
    @PreAuthorize(AppConstants.ALL_AUTHORIZE)
    public ApiResponse<List<MediaFileDto>> getMediaInfoByRecord(@PathVariable Long recordId) {
        log.info("Fetching media info for recordId={}", recordId);
        return ApiResponse.success(mediaInfoService.getByRecordId(recordId));
    }


    @GetMapping("/search")
    @PreAuthorize(AppConstants.ALL_AUTHORIZE)
    public ApiResponse<List<DbWorldRecords.StreamableFileInfo>> search(
            @Valid @NotEmpty @RequestParam("q") String query) {

        log.info("Searching media query={}", query);
        List<DbWorldRecords.StreamableFileInfo> results = streamService.listAllStreamable()
                .stream()
                .filter(f -> streamService.matchesQuery(f.fileName(), query))
                .collect(Collectors.toList());
        return ApiResponse.success(results);
    }

    @GetMapping("/search/media-info/file/{fileId}")
    @PreAuthorize(AppConstants.ALL_AUTHORIZE)
    public ApiResponse<MediaFileDto> getMediaInfoByFile(@PathVariable String fileId) {
        MediaFileDto mediaFileDto = streamService.listAllStreamable()
                .stream()
                .filter(f -> f.fileId().equals(fileId))
                .map(f -> mediaInfoService.collectMediaInfo(streamService.resolveRealPath(f.filePath())))
                .findFirst().orElseThrow(() -> new DbWorldException("MediaFile not found: " + fileId));
        return ApiResponse.success(mediaFileDto);
    }

    @GetMapping("/search/media-info")
    @PreAuthorize(AppConstants.ALL_AUTHORIZE)
    public ApiResponse<MediaFileDto> getMediaInfoByPath(@RequestParam("path") String path) {
        Path realPath = streamService.resolveRealPath(path);
        if (!java.nio.file.Files.exists(realPath)) {
            throw new DbWorldException("MediaFile not found: " + path);
        }
        return ApiResponse.success(mediaInfoService.collectMediaInfo(realPath));
    }

    private String getClientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        String xri = req.getHeader("X-Real-IP");
        return (xri != null && !xri.isBlank()) ? xri : req.getRemoteAddr();
    }
}
