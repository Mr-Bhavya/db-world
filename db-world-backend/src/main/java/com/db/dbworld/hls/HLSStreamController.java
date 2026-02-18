package com.db.dbworld.hls;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/hls")
@RequiredArgsConstructor
@Log4j2
public class HLSStreamController {

    private final HLSContentRepository hlsContentRepository;
    private final HLSVariantRepository hlsVariantRepository;
    private final HLSPlaybackSessionRepository hlsPlaybackSessionRepository; // Added missing repository

    @Value("${hls.base-url:http://localhost:9000}")
    private String hlsBaseUrl;

    /**
     * Get master playlist for content
     */
    @GetMapping("/playback/{recordId}")
    public ResponseEntity<Resource> getMasterPlaylist(@PathVariable Long recordId,
                                                      HttpServletRequest request) {

        // Log request for debugging
        log.info("Request for master playlist - recordId: {}, IP: {}",
                recordId, request.getRemoteAddr());

        List<HLSContentEntity> hlsContents = hlsContentRepository.findAllByRecordId(recordId);
        if (hlsContents.isEmpty()) {
            log.warn("No HLS content found for recordId: {}", recordId);
            return ResponseEntity.notFound().build();
        }

        // Get the first content (or implement logic to choose based on quality)
        HLSContentEntity hlsContent = hlsContents.get(0);
        Path masterPlaylist = Paths.get(hlsContent.getMasterPlaylistPath());

        if (!Files.exists(masterPlaylist)) {
            log.error("Master playlist file not found at path: {}", masterPlaylist);
            return ResponseEntity.notFound().build();
        }

        return serveHLSFile(masterPlaylist, "application/vnd.apple.mpegurl");
    }

    /**
     * Stream HLS variant (resolution-specific)
     */
    @GetMapping("/playback/{recordId}/{resolution}/{filename}")
    public ResponseEntity<Resource> streamHLS(@PathVariable Long recordId,
                                              @PathVariable String resolution,
                                              @PathVariable String filename,
                                              HttpServletRequest request) {

        log.debug("Stream request - recordId: {}, resolution: {}, filename: {}",
                recordId, resolution, filename);

        List<HLSContentEntity> hlsContents = hlsContentRepository.findAllByRecordId(recordId);
        if (hlsContents.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        // Find the variant
        for (HLSContentEntity hlsContent : hlsContents) {
            Optional<HLSVariantEntity> variant = hlsVariantRepository
                    .findByHlsContentIdAndResolutionName(hlsContent.getId(), resolution);

            if (variant.isPresent()) {
                Path variantPath = Paths.get(variant.get().getHlsPath()).getParent();
                Path requestedFile = variantPath.resolve(filename);

                if (Files.exists(requestedFile)) {
                    String contentType = getContentType(filename);
                    return serveHLSFile(requestedFile, contentType);
                } else {
                    log.warn("Requested file not found: {}", requestedFile);
                }
            }
        }

        log.warn("No variant found for recordId: {}, resolution: {}", recordId, resolution);
        return ResponseEntity.notFound().build();
    }

    /**
     * Stream HLS with authentication
     */
    @GetMapping("/stream/{recordId}/{filename}")
    public ResponseEntity<Resource> streamHLSAuth(@PathVariable Long recordId,
                                                  @PathVariable String filename,
                                                  @RequestParam(required = false) String token,
                                                  HttpServletRequest request) {

        // Add authentication logic here
        if (token != null && !validateToken(token)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        // Find content and stream the requested file
        List<HLSContentEntity> hlsContents = hlsContentRepository.findAllByRecordId(recordId);
        if (hlsContents.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        HLSContentEntity hlsContent = hlsContents.get(0);
        Path masterPlaylist = Paths.get(hlsContent.getMasterPlaylistPath()).getParent();
        Path requestedFile = masterPlaylist.resolve(filename);

        if (Files.exists(requestedFile)) {
            String contentType = getContentType(filename);
            return serveHLSFile(requestedFile, contentType);
        }

        return ResponseEntity.notFound().build();
    }

    /**
     * Get HLS content info
     */
    @GetMapping("/content/{recordId}/info")
    public ResponseEntity<HLSDto.HLSContentResponse> getContentInfo(@PathVariable Long recordId) {

        List<HLSContentEntity> hlsContents = hlsContentRepository.findAllByRecordId(recordId);
        if (hlsContents.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        HLSContentEntity hlsContent = hlsContents.get(0);
        HLSDto.HLSContentResponse response = new HLSDto.HLSContentResponse();

        response.setRecordId(recordId);
        response.setMediaFileId(hlsContent.getMediaFileInfo().getId());
        response.setStatus(hlsContent.getStatus());
        response.setGeneratedAt(hlsContent.getGeneratedAt());
        response.setPlaybackUrl(hlsContent.getPlaybackUrl());

        // Get all variants
        List<HLSVariantEntity> variants = hlsVariantRepository
                .findByHlsContentId(hlsContent.getId());

        List<HLSDto.VariantInfo> variantInfos = variants.stream()
                .map(v -> {
                    HLSDto.VariantInfo vi = new HLSDto.VariantInfo();
                    vi.setResolution(v.getResolutionName());
                    vi.setWidth(v.getWidth());
                    vi.setHeight(v.getHeight());
                    vi.setBitrate(v.getBitrate());
                    vi.setPlaylistUrl(v.getPlaylistUrl());
                    return vi;
                })
                .collect(Collectors.toList());

        response.setVariants(variantInfos);

        return ResponseEntity.ok(response);
    }

    /**
     * Start playback session
     */
    @PostMapping("/session/start")
    public ResponseEntity<HLSDto.PlaybackSessionResponse> startPlaybackSession(
            @RequestBody HLSDto.StartPlaybackRequest request) {

        HLSDto.PlaybackSessionResponse response = new HLSDto.PlaybackSessionResponse();
        response.setSessionId(UUID.randomUUID().toString());
        response.setStartedAt(LocalDateTime.now());

        // Save session to DB
        HLSPlaybackSessionEntity session = new HLSPlaybackSessionEntity();
        session.setSessionId(response.getSessionId());
        session.setUserId(Long.valueOf(request.getUserId()));
        session.setDeviceInfo(request.getDeviceInfo());
        session.setSelectedResolution(request.getResolution());
        session.setStartedAt(response.getStartedAt());

        // Find HLS content
        Optional<HLSContentEntity> hlsContent = hlsContentRepository
                .findByRecordId(request.getRecordId());

        if (hlsContent.isPresent()) {
            session.setHlsContent(hlsContent.get());
            hlsPlaybackSessionRepository.save(session); // Save session
            response.setMasterPlaylistUrl(hlsBaseUrl + "/api/hls/playback/" + request.getRecordId());
        } else {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(response);
    }

    /**
     * Update playback session (heartbeat)
     */
    @PostMapping("/session/{sessionId}/heartbeat")
    public ResponseEntity<Void> updatePlaybackSession(@PathVariable String sessionId,
                                                      @RequestBody HLSDto.PlaybackHeartbeatRequest request) {

        Optional<HLSPlaybackSessionEntity> session = hlsPlaybackSessionRepository
                .findBySessionId(sessionId);

        if (session.isPresent()) {
            HLSPlaybackSessionEntity sessionEntity = session.get();
            sessionEntity.setCurrentTime(request.getCurrentTime());
            sessionEntity.setLastHeartbeat(LocalDateTime.now());
            hlsPlaybackSessionRepository.save(sessionEntity);
            return ResponseEntity.ok().build();
        }

        return ResponseEntity.notFound().build();
    }

    private ResponseEntity<Resource> serveHLSFile(Path filePath, String contentType) {
        try {
            Resource resource = new FileSystemResource(filePath);

            // Check if file exists and is readable
            if (!resource.exists() || !resource.isReadable()) {
                log.error("File not accessible: {}", filePath);
                return ResponseEntity.notFound().build();
            }

            // Set appropriate headers for HLS streaming
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(contentType));
            headers.setCacheControl(CacheControl.maxAge(3600, TimeUnit.SECONDS));
            headers.set("Accept-Ranges", "bytes");

            // Add CORS headers if needed
            headers.set("Access-Control-Allow-Origin", "*");
            headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
            headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

            // For .ts files, allow partial content requests
            if (contentType.equals("video/MP2T")) {
                headers.set("Access-Control-Expose-Headers", "Content-Length, Accept-Ranges");
            }

            return ResponseEntity.ok()
                    .headers(headers)
                    .body(resource);

        } catch (Exception e) {
            log.error("Error serving HLS file: {}", filePath, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    private String getContentType(String filename) {
        if (filename.endsWith(".m3u8")) {
            return "application/vnd.apple.mpegurl";
        } else if (filename.endsWith(".ts")) {
            return "video/MP2T";
        } else if (filename.endsWith(".mp4")) {
            return "video/mp4";
        } else if (filename.endsWith(".key")) {
            return "application/octet-stream";
        } else if (filename.endsWith(".m4s")) {
            return "video/iso.segment";
        }
        return "application/octet-stream";
    }

    private boolean validateToken(String token) {
        // Implement your token validation logic here
        // This is a placeholder - implement proper JWT validation
        return token != null && !token.isEmpty();
    }

    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<String> healthCheck() {
        return ResponseEntity.ok("HLS Streaming Service is running");
    }

    /**
     * OPTIONS endpoint for CORS preflight
     */
    @RequestMapping(value = "/**", method = RequestMethod.OPTIONS)
    public ResponseEntity<Void> handleOptions() {
        return ResponseEntity.ok()
                .header("Access-Control-Allow-Origin", "*")
                .header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                .header("Access-Control-Allow-Headers", "Content-Type, Authorization")
                .build();
    }
}