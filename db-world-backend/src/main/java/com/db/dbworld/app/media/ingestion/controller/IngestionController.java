package com.db.dbworld.app.media.ingestion.controller;

import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.media.aria2.Aria2RpcService;
import com.db.dbworld.app.media.ingestion.entity.IngestionJobEntity;
import com.db.dbworld.app.media.ingestion.model.*;
import com.db.dbworld.app.media.ingestion.pipeline.IngestionPipeline;
import com.db.dbworld.app.media.ingestion.repository.IngestionJobRepository;
import com.db.dbworld.app.media.ingestion.service.FileBrowserService;
import com.db.dbworld.app.media.ingestion.service.YtFormatService;
import com.db.dbworld.app.media.ingestion.store.IngestionJobStore;
import com.db.dbworld.app.media.ingestion.tracking.MirrorStatus;
import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import com.db.dbworld.payloads.ApiResponse;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.Map;

/**
 * REST API for the ingestion pipeline.
 *
 * Lifecycle endpoints:
 *   POST   /api/ingestion                  — start one or more download jobs
 *   PUT    /api/ingestion/{jobId}/cancel   — gracefully cancel a running job
 *   PUT    /api/ingestion/{jobId}/pause    — pause (Aria2 / HTTP-TORRENT only)
 *   PUT    /api/ingestion/{jobId}/resume   — resume a paused Aria2 job
 *   POST   /api/ingestion/{jobId}/rerun    — rerun with same request (new job ID)
 *   DELETE /api/ingestion/{jobId}          — purge: cancel + remove from DB
 *
 * Status endpoints:
 *   GET    /api/ingestion/status           — live in-memory status for all jobs
 *   GET    /api/ingestion/{jobId}/report   — HTML progress report for one job
 *   GET    /api/ingestion/history          — all persisted jobs from DB
 *   GET    /api/ingestion/history/{jobId}  — single persisted job from DB
 *   GET    /api/ingestion/history/record/{recordId} — jobs for a cinema record
 *
 * ── How GID-based pause/resume works ──────────────────────────────────────
 *  1. Aria2DownloadStrategy calls addUri() → Aria2 returns a GID.
 *  2. GID is stored in IngestionJobStore keyed by jobId.
 *  3. pause/resume read the GID and call aria2RpcService.pause/unpause(gid).
 *  4. yt-dlp (YOUTUBE) has no GID — pause/resume return 400.
 *  5. The Aria2DownloadStrategy poll loop handles "paused" status by waiting.
 * ──────────────────────────────────────────────────────────────────────────
 */
@RestController
@RequestMapping("/api/ingestion")
@Log4j2
public class IngestionController {

    private final IngestionPipeline      pipeline;
    private final TrackingService        trackingService;
    private final IngestionJobStore      jobStore;
    private final Aria2RpcService        aria2RpcService;
    private final IngestionJobRepository jobRepository;
    private final YtFormatService        ytFormatService;
    private final FileBrowserService     fileBrowserService;
    private final RecordRepository       recordRepository;

    public IngestionController(
            IngestionPipeline      pipeline,
            TrackingService        trackingService,
            IngestionJobStore      jobStore,
            Aria2RpcService        aria2RpcService,
            IngestionJobRepository jobRepository,
            YtFormatService        ytFormatService,
            FileBrowserService     fileBrowserService,
            RecordRepository       recordRepository
    ) {
        this.pipeline           = pipeline;
        this.trackingService    = trackingService;
        this.jobStore           = jobStore;
        this.aria2RpcService    = aria2RpcService;
        this.jobRepository      = jobRepository;
        this.ytFormatService    = ytFormatService;
        this.fileBrowserService = fileBrowserService;
        this.recordRepository   = recordRepository;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // START
    // ══════════════════════════════════════════════════════════════════════════

    @PostMapping
    public ApiResponse<List<String>> ingest(@RequestBody IngestionRequest request) {
        List<String> uris = Optional.ofNullable(request.getUris())
                .filter(l -> !l.isEmpty())
                .orElseGet(() -> Collections.singletonList(request.getUri()));

        List<String> jobIds = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (String uri : uris) {
            try {
                String jobId = pipeline.start(cloneRequest(request, uri));
                jobIds.add(jobId);
            } catch (Exception e) {
                log.error("Failed to start ingestion for URI={}", uri, e);
                errors.add(uri + " → " + e.getMessage());
            }
        }

        String msg = errors.isEmpty()
                ? "All jobs started (" + jobIds.size() + ")"
                : "Some jobs failed: " + String.join("; ", errors);

        return ApiResponse.success(msg, jobIds);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CANCEL
    // ══════════════════════════════════════════════════════════════════════════

    @PutMapping("/{jobId}/cancel")
    public ApiResponse<Void> cancel(@PathVariable String jobId) {
        trackingService.updateStatus(jobId, MirrorStatus.CANCELLED);
        jobStore.executeCancelAction(jobId);
        log.info("[{}] Cancel requested", jobId);
        return ApiResponse.success("Job " + jobId + " cancelled");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PAUSE  (Aria2 only — HTTP / TORRENT)
    // ══════════════════════════════════════════════════════════════════════════

    @PutMapping("/{jobId}/pause")
    public ApiResponse<Void> pause(@PathVariable String jobId) {
        String sourceType = jobStore.getSourceType(jobId);

        if ("YOUTUBE".equals(sourceType)) {
            return ApiResponse.error(400,
                    "Pause is not supported for yt-dlp (YOUTUBE) downloads. "
                    + "Cancel and rerun instead.");
        }

        Optional<String> gid = jobStore.getGid(jobId);
        if (gid.isEmpty()) {
            return ApiResponse.error(400,
                    "No Aria2 GID for job " + jobId
                    + " — job may not have started yet or has already finished.");
        }

        try {
            aria2RpcService.pause(gid.get());
            trackingService.updateStatus(jobId, MirrorStatus.PAUSED);
            log.info("[{}] Paused (GID: {})", jobId, gid.get());
            return ApiResponse.success("Job " + jobId + " paused (GID: " + gid.get() + ")");
        } catch (Exception e) {
            log.error("[{}] Pause failed", jobId, e);
            return ApiResponse.error(500, "Pause failed: " + e.getMessage());
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // RESUME (Aria2 only)
    // ══════════════════════════════════════════════════════════════════════════

    @PutMapping("/{jobId}/resume")
    public ApiResponse<Void> resume(@PathVariable String jobId) {
        String sourceType = jobStore.getSourceType(jobId);

        if ("YOUTUBE".equals(sourceType)) {
            return ApiResponse.error(400,
                    "Resume is not supported for yt-dlp (YOUTUBE) downloads.");
        }

        Optional<String> gid = jobStore.getGid(jobId);
        if (gid.isEmpty()) {
            return ApiResponse.error(400, "No Aria2 GID for job " + jobId);
        }

        try {
            aria2RpcService.unpause(gid.get());
            trackingService.updateStatus(jobId, MirrorStatus.DOWNLOADING);
            log.info("[{}] Resumed (GID: {})", jobId, gid.get());
            return ApiResponse.success("Job " + jobId + " resumed (GID: " + gid.get() + ")");
        } catch (Exception e) {
            log.error("[{}] Resume failed", jobId, e);
            return ApiResponse.error(500, "Resume failed: " + e.getMessage());
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // RERUN
    // ══════════════════════════════════════════════════════════════════════════

    @PostMapping("/{jobId}/rerun")
    public ApiResponse<String> rerun(@PathVariable String jobId) {
        // 1. Try in-memory store (job still tracked)
        Optional<IngestionRequest> stored = jobStore.getRequest(jobId);
        if (stored.isPresent()) {
            String newJobId = pipeline.start(stored.get());
            log.info("[{}] Rerun started → new jobId={}", jobId, newJobId);
            return ApiResponse.success("Rerun started", newJobId);
        }

        // 2. Fall back to DB record
        return jobRepository.findById(jobId)
                .map(entity -> {
                    String newJobId = pipeline.start(reconstructRequest(entity));
                    log.info("[{}] Rerun from DB → new jobId={}", jobId, newJobId);
                    return ApiResponse.success("Rerun started (from DB)", newJobId);
                })
                .orElse(ApiResponse.error(404,
                        "Job " + jobId + " not found in store or DB", (String) null));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PURGE  (cancel + delete from DB)
    // ══════════════════════════════════════════════════════════════════════════

    @DeleteMapping("/{jobId}")
    public ApiResponse<Void> purge(@PathVariable String jobId) {
        trackingService.updateStatus(jobId, MirrorStatus.CANCELLED);
        jobStore.executeCancelAction(jobId);
        jobStore.remove(jobId);
        jobRepository.deleteById(jobId);
        log.info("[{}] Purged (cancelled + DB deleted)", jobId);
        return ApiResponse.success("Job " + jobId + " purged");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // STATUS (live, in-memory)
    // ══════════════════════════════════════════════════════════════════════════

    @GetMapping("/status")
    public ApiResponse<Object> getAllStatus() {
        return ApiResponse.success(trackingService.getAll());
    }

    @GetMapping("/{jobId}/report")
    public ApiResponse<String> getHtmlReport(@PathVariable String jobId) {
        // Prefer DB version (completed/failed/cancelled jobs with persisted report)
        String persisted = jobRepository.findById(jobId)
                .map(e -> e.getHtmlReport())
                .filter(r -> r != null && !r.isBlank())
                .orElse(null);
        if (persisted != null) {
            return ApiResponse.success(org.springframework.http.HttpStatus.OK, null, persisted);
        }
        // Fall back to in-memory for currently active jobs
        return ApiResponse.success(org.springframework.http.HttpStatus.OK, null, trackingService.getHtmlReport(jobId));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // HISTORY (persisted DB records)
    // ══════════════════════════════════════════════════════════════════════════

    @GetMapping("/history")
    public ApiResponse<List<Map<String, Object>>> getHistory() {
        List<Map<String, Object>> history = jobRepository.findAll(
                        Sort.by(Sort.Direction.DESC, "startedAt"))
                .stream()
                .map(this::toHistoryDto)
                .collect(java.util.stream.Collectors.toList());
        return ApiResponse.success(history);
    }

    @GetMapping("/history/{jobId}")
    public ApiResponse<IngestionJobEntity> getHistoryEntry(@PathVariable String jobId) {
        return jobRepository.findById(jobId)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "Not found: " + jobId, (IngestionJobEntity) null));
    }

    @GetMapping("/history/record/{recordId}")
    public ApiResponse<List<IngestionJobEntity>> getHistoryByRecord(@PathVariable Long recordId) {
        return ApiResponse.success(jobRepository.findByRecordId(recordId));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // YOUTUBE FORMATS
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Fetch available video/audio formats for a YouTube (or compatible) URL.
     * The frontend uses this to populate the format picker before submitting.
     */
    @GetMapping("/yt/formats")
    public ApiResponse<YtFormatsResponse> getYtFormats(@RequestParam String url) {
        try {
            return ApiResponse.success(ytFormatService.fetchFormats(url));
        } catch (Exception e) {
            log.error("Failed to fetch yt formats for url={}", url, e);
            return ApiResponse.error(500, "Failed to fetch formats: " + e.getMessage(), (YtFormatsResponse) null);
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // FILE BROWSER  (stream-path / temp-path)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * List files in the server's stream-path or temp-path.
     * Used by the "Link existing file" browser dialog.
     *
     * @param root    "stream" or "temp"
     * @param subPath relative sub-directory, default = root of the chosen area
     */
    @GetMapping("/files/browse")
    public ApiResponse<java.util.List<FileBrowserItem>> browseFiles(
            @RequestParam String root,
            @RequestParam(required = false, defaultValue = "") String subPath
    ) {
        try {
            return ApiResponse.success(fileBrowserService.browse(root, subPath));
        } catch (SecurityException e) {
            return ApiResponse.error(403, e.getMessage(), (java.util.List<FileBrowserItem>) null);
        } catch (Exception e) {
            log.error("File browser error root={} subPath={}", root, subPath, e);
            return ApiResponse.error(500, e.getMessage(), (java.util.List<FileBrowserItem>) null);
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LINK EXISTING FILE  (skip download, run processing only)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Start an ingestion job for a file already present on the server.
     * The DOWNLOAD step is skipped; the pipeline runs MEDIAINFO → FFMPEG → DB save.
     *
     * Body must include {@code localFilePath} (absolute server path).
     * Optionally include {@code recordId}, {@code season}, {@code episode}, {@code trackFilter}.
     */
    @PostMapping("/link-existing")
    public ApiResponse<String> linkExisting(@RequestBody IngestionRequest request) {
        if (request.getLocalFilePath() == null || request.getLocalFilePath().isBlank()) {
            return ApiResponse.error(400, "localFilePath is required for link-existing", (String) null);
        }
        try {
            String jobId = pipeline.start(request);
            log.info("Link-existing job started jobId={} path={}", jobId, request.getLocalFilePath());
            return ApiResponse.success("Link-existing job started", jobId);
        } catch (Exception e) {
            log.error("Link-existing failed path={}", request.getLocalFilePath(), e);
            return ApiResponse.error(500, e.getMessage(), (String) null);
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════════════════════════════════════════

    private Map<String, Object> toHistoryDto(IngestionJobEntity e) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("jobId",       e.getJobId());
        m.put("status",      e.getStatus());
        m.put("step",        e.getStep());
        m.put("sourceType",  e.getSourceType());
        m.put("uri",         e.getUri());
        m.put("fileName",    e.getFileName());
        m.put("totalBytes",  e.getTotalBytes());
        m.put("startedAt",   e.getStartedAt());
        m.put("completedAt", e.getCompletedAt());
        m.put("failReason",  e.getFailReason());
        m.put("recordId",    e.getRecordId());
        if (e.getRecordId() != null) {
            String rName = recordRepository.findById(e.getRecordId())
                    .map(r -> r.getName()).orElse(null);
            m.put("recordName", rName);
        }
        return m;
    }

    private IngestionRequest cloneRequest(IngestionRequest base, String uri) {
        IngestionRequest r = new IngestionRequest();
        r.setUri(uri);
        r.setFolderName(base.getFolderName());
        r.setUsername(base.getUsername());
        r.setPassword(base.getPassword());
        r.setUrlProtected(base.isUrlProtected());
        r.setFileName(base.getFileName());
        r.setExpectedSize(base.getExpectedSize());
        r.setExtract(base.isExtract());
        r.setExtractPassword(base.getExtractPassword());
        r.setRename(base.isRename());
        r.setVideoITag(base.getVideoITag());
        r.setAudioITag(base.getAudioITag());
        r.setOnlyAudio(base.isOnlyAudio());
        r.setTorrentBase64(base.getTorrentBase64());
        r.setRecordId(base.getRecordId());
        r.setSeason(base.getSeason());
        r.setEpisode(base.getEpisode());
        r.setTrackFilter(base.getTrackFilter());
        r.setLocalFilePath(base.getLocalFilePath());
        return r;
    }

    private IngestionRequest reconstructRequest(IngestionJobEntity entity) {
        IngestionRequest r = new IngestionRequest();
        r.setUri(entity.getUri());
        r.setFolderName(entity.getFolderName());
        r.setRecordId(entity.getRecordId());
        r.setSeason(entity.getSeasonNumber());
        r.setEpisode(entity.getEpisodeNumber());
        return r;
    }
}
