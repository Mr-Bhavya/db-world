package com.db.dbworld.app.media.ingestion.controller;

import com.db.dbworld.app.cinema.catalog.dto.RecordAutocompleteDto;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.media.aria2.Aria2RpcService;
import com.db.dbworld.app.media.ingestion.entity.IngestionJobEntity;
import com.db.dbworld.app.media.ingestion.model.*;
import com.db.dbworld.app.media.ingestion.pipeline.IngestionPipeline;
import com.db.dbworld.app.media.ingestion.queue.IngestionDownloadQueue;
import com.db.dbworld.app.media.ingestion.queue.IngestionQueueStatusService;
import com.db.dbworld.app.media.ingestion.repository.IngestionJobRepository;
import com.db.dbworld.app.media.ingestion.service.FileBrowserService;
import com.db.dbworld.app.media.ingestion.service.IngestionInputGuard;
import com.db.dbworld.app.media.ingestion.service.YtFormatService;
import com.db.dbworld.app.media.ingestion.store.IngestionJobStore;
import com.db.dbworld.app.media.ingestion.migration.StreamMigrationService;
import com.db.dbworld.app.media.ingestion.tracking.MirrorStatus;
import com.db.dbworld.app.media.ingestion.repository.IngestionHistoryRow;
import com.db.dbworld.app.media.ingestion.tracking.TrackReviewCoordinator;
import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.config.AppConstants;
import lombok.extern.log4j.Log4j2;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * REST API for the ingestion pipeline.
 *
 * Lifecycle endpoints:
 *   POST   /api/ingestion                  — start one or more download jobs
 *   PUT    /api/ingestion/{jobId}/cancel   — gracefully cancel a running job
 *   PUT    /api/ingestion/{jobId}/pause    — pause (Aria2 / HTTP-TORRENT only)
 *   PUT    /api/ingestion/{jobId}/resume   — resume a paused Aria2 job
 *   POST   /api/ingestion/{jobId}/rerun    — rerun with same request (new job ID)
 *   GET    /api/ingestion/{jobId}/params   — re-editable request snapshot (rerun-with-edit)
 *   PATCH  /api/ingestion/{jobId}/params   — live-edit safe fields (season/episode) on a running job
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
@PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
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
    private final StreamMigrationService streamMigrationService;
    private final TrackReviewCoordinator trackReviewCoordinator;
    private final IngestionDownloadQueue downloadQueue;
    private final IngestionInputGuard    inputGuard;
    private final IngestionQueueStatusService queueStatusService;

    public IngestionController(
            IngestionPipeline      pipeline,
            TrackingService        trackingService,
            IngestionJobStore      jobStore,
            Aria2RpcService        aria2RpcService,
            IngestionJobRepository jobRepository,
            YtFormatService        ytFormatService,
            FileBrowserService     fileBrowserService,
            RecordRepository       recordRepository,
            StreamMigrationService streamMigrationService,
            TrackReviewCoordinator trackReviewCoordinator,
            IngestionDownloadQueue downloadQueue,
            IngestionInputGuard    inputGuard,
            IngestionQueueStatusService queueStatusService
    ) {
        this.pipeline                = pipeline;
        this.trackingService         = trackingService;
        this.jobStore                = jobStore;
        this.aria2RpcService         = aria2RpcService;
        this.jobRepository           = jobRepository;
        this.ytFormatService         = ytFormatService;
        this.fileBrowserService      = fileBrowserService;
        this.recordRepository        = recordRepository;
        this.streamMigrationService  = streamMigrationService;
        this.trackReviewCoordinator  = trackReviewCoordinator;
        this.downloadQueue           = downloadQueue;
        this.inputGuard              = inputGuard;
        this.queueStatusService      = queueStatusService;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // START
    // ══════════════════════════════════════════════════════════════════════════

    @PostMapping
    public ApiResponse<List<String>> ingest(@RequestBody IngestionRequest request) {
        try {
            inputGuard.validate(request);
        } catch (IllegalArgumentException | SecurityException e) {
            return ApiResponse.error(400, e.getMessage(), (List<String>) null);
        }
        // Playlist single-card: one job downloads + processes every selected item.
        List<PlaylistItem> playlistItems = request.getPlaylistItems();
        if (playlistItems != null && !playlistItems.isEmpty()) {
            if (request.getUri() == null || request.getUri().isBlank()) {
                // Seed the URI from the first item so the source handler resolves (YOUTUBE).
                request.setUri(playlistItems.get(0).getUri());
            }
            try {
                String jobId = pipeline.start(request);
                log.info("Playlist job started jobId={} items={}", jobId, playlistItems.size());
                return ApiResponse.success(
                        "Playlist job started (" + playlistItems.size() + " items)",
                        Collections.singletonList(jobId));
            } catch (Exception e) {
                log.error("Failed to start playlist job", e);
                return ApiResponse.error(500,
                        "Failed to start playlist job: " + e.getMessage(), (List<String>) null);
            }
        }

        List<String> uris = Optional.ofNullable(request.getUris())
                .filter(l -> !l.isEmpty())
                .orElseGet(() -> Collections.singletonList(request.getUri()));

        log.debug("ingest invoked — {} uri(s), recordId={}", uris.size(), request.getRecordId());

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

        log.info("ingest result — started={}, failed={}", jobIds.size(), errors.size());

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
        trackReviewCoordinator.cancel(jobId); // unpark if it's waiting for track selection
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
    // RELEASE  (pull a queued job out of the FIFO to download in parallel)
    // ══════════════════════════════════════════════════════════════════════════

    @PutMapping("/{jobId}/release")
    public ApiResponse<Void> release(@PathVariable String jobId) {
        boolean released = downloadQueue.releaseNow(jobId);
        if (!released) {
            return ApiResponse.error(400,
                    "Job " + jobId + " is not waiting in the download queue "
                    + "(already downloading, not an HTTP job, or already finished).");
        }
        log.info("[{}] Released from download queue to run in parallel", jobId);
        return ApiResponse.success("Job " + jobId + " released — downloading in parallel");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // RERUN
    // ══════════════════════════════════════════════════════════════════════════

    @PostMapping("/{jobId}/rerun")
    public ApiResponse<String> rerun(@PathVariable String jobId,
                                     @RequestBody(required = false) IngestionRequest overrides) {
        // Reconstruct the ORIGINAL request — in-memory store first (keeps secrets), then the DB row.
        IngestionRequest original = jobStore.getRequest(jobId)
                .orElseGet(() -> jobRepository.findById(jobId).map(this::reconstructRequest).orElse(null));
        if (original == null) {
            return ApiResponse.error(404, "Job " + jobId + " not found in store or DB", (String) null);
        }

        // No body → plain rerun with the original request (the "rerun unchanged" path). Body → edited
        // rerun: use the edited body but backfill any secrets the params snapshot can't echo
        // (passwords, .torrent bytes) so protected sources still rerun without re-typing them.
        boolean edited = overrides != null;
        IngestionRequest toRun = edited ? overrides : original;
        if (edited) backfillSecrets(toRun, original);
        try {
            inputGuard.validate(toRun);
        } catch (IllegalArgumentException | SecurityException e) {
            return ApiResponse.error(400, e.getMessage(), (String) null);
        }

        String newJobId = pipeline.start(toRun);
        log.info("[{}] Rerun started ({}) → new jobId={}", jobId, edited ? "edited" : "as-is", newJobId);
        return ApiResponse.success("Rerun started", newJobId);
    }

    /** Copy secrets the params snapshot never echoes from the original request into an edited rerun. */
    private void backfillSecrets(IngestionRequest edited, IngestionRequest original) {
        if (original == null) return;
        if (isBlank(edited.getPassword()))        edited.setPassword(original.getPassword());
        if (isBlank(edited.getUsername()))        edited.setUsername(original.getUsername());
        if (isBlank(edited.getExtractPassword())) edited.setExtractPassword(original.getExtractPassword());
        if (isBlank(edited.getTorrentBase64()))   edited.setTorrentBase64(original.getTorrentBase64());
        // If only processing fields were edited and the source wasn't re-supplied, keep the original.
        if (isBlank(edited.getUri()) && isBlank(edited.getLocalFilePath())) {
            edited.setUri(original.getUri());
            edited.setLocalFilePath(original.getLocalFilePath());
        }
    }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }

    // ══════════════════════════════════════════════════════════════════════════
    // PARAMS  (re-editable snapshot for "rerun with edit")
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Return the original request params for a job so the ingestion form can be
     * pre-filled for a "rerun with edit" flow. Prefers the in-memory request
     * (still-tracked jobs), falling back to the persisted DB row.
     */
    @GetMapping("/{jobId}/params")
    public ApiResponse<JobParamsDto> getJobParams(@PathVariable String jobId) {
        Optional<IngestionRequest> stored = jobStore.getRequest(jobId);
        if (stored.isPresent()) {
            return ApiResponse.success(toParamsDto(stored.get()));
        }
        return jobRepository.findById(jobId)
                .map(e -> ApiResponse.success(toParamsDto(reconstructRequest(e))))
                .orElse(ApiResponse.error(404,
                        "Job " + jobId + " not found in store or DB", (JobParamsDto) null));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LIVE EDIT  (patch safe fields on a running job)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Live-edit a still-running job. Each field is applied to the in-memory request and takes effect
     * when the pipeline reaches the stage that consumes it, so editing is phase-gated against the
     * job's current status:
     * <ul>
     *   <li>Processing-tier fields (record link, season/episode, extract, rename, track filter) are
     *       editable until the download finishes (QUEUED / STARTED / DOWNLOADING / PAUSED).</li>
     *   <li>Download-tier fields (source, format, folder, auth) are editable only while still QUEUED.</li>
     * </ul>
     * Once the job is processing or terminal it returns 400 (the caller should offer "Edit & rerun").
     */
    @PatchMapping("/{jobId}/params")
    public ApiResponse<Void> editJobParams(@PathVariable String jobId,
                                           @RequestBody JobEditRequest edit) {
        MirrorStatus status = trackingService.getStatus(jobId);
        if (status == null) {
            return ApiResponse.error(400, "Job " + jobId + " is not active — only running jobs can be edited.");
        }
        boolean beforeProcessing = status == MirrorStatus.QUEUED || status == MirrorStatus.STARTED
                || status == MirrorStatus.DOWNLOADING || status == MirrorStatus.PAUSED
                || status == MirrorStatus.AWAITING_INPUT;
        if (!beforeProcessing) {
            return ApiResponse.error(400,
                    "Job " + jobId + " is already processing or finished — use \"Edit & rerun\" to change it.");
        }
        boolean allowDownloadFields = status == MirrorStatus.QUEUED;
        if (allowDownloadFields && edit.getUri() != null) {
            try {
                inputGuard.validateUri(edit.getUri());
            } catch (IllegalArgumentException e) {
                return ApiResponse.error(400, e.getMessage());
            }
        }

        boolean applied = jobStore.applyEdit(jobId, edit, allowDownloadFields);
        if (!applied) {
            return ApiResponse.error(400, "Job " + jobId + " is no longer tracked — it can't be edited.");
        }
        log.info("[{}] Live edit applied (status={}, downloadFields={})", jobId, status, allowDownloadFields);
        return ApiResponse.success("Job " + jobId + " updated");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // TRACK REVIEW  (interactive audio/subtitle selection while AWAITING_INPUT)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Detected audio/subtitle tracks + the smart-default suggestion for a job parked in
     * {@code AWAITING_INPUT}. 404 once the job has resumed (selection made, timed out, or cancelled).
     */
    @GetMapping("/{jobId}/tracks")
    public ApiResponse<TrackReviewOptions> getTrackOptions(@PathVariable String jobId) {
        return trackReviewCoordinator.getOptions(jobId)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404,
                        "Job " + jobId + " is not awaiting track selection.", (TrackReviewOptions) null));
    }

    /**
     * Submit the admin's audio/subtitle choice for a parked job. Builds the model track filter,
     * unparks the pipeline, and processing continues with the chosen tracks.
     */
    @PostMapping("/{jobId}/tracks")
    public ApiResponse<Void> submitTrackSelection(@PathVariable String jobId,
                                                  @RequestBody TrackReviewSelection selection) {
        if (!trackReviewCoordinator.isPending(jobId)) {
            return ApiResponse.error(400, "Job " + jobId + " is not awaiting track selection.");
        }
        boolean applied = trackReviewCoordinator.submit(jobId, selection.toTrackFilter());
        if (!applied) {
            return ApiResponse.error(400, "Job " + jobId + " is no longer waiting — the selection was not applied.");
        }
        log.info("[{}] Track selection submitted", jobId);
        return ApiResponse.success("Track selection applied — processing will continue");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PURGE  (cancel + delete from DB)
    // ══════════════════════════════════════════════════════════════════════════

    @DeleteMapping("/{jobId}")
    public ApiResponse<Void> purge(@PathVariable String jobId) {
        trackingService.updateStatus(jobId, MirrorStatus.CANCELLED);
        trackReviewCoordinator.cancel(jobId); // unpark if it's waiting for track selection
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

    /** Download-slot occupancy, FIFO order, aria2 throughput and free disk — polled by the queue bar. */
    @GetMapping("/queue")
    public ApiResponse<IngestionQueueStatusService.QueueStatus> getQueueStatus() {
        return ApiResponse.success(queueStatusService.snapshot());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // BULK  (clear-finished | retry-failed | pause-all | resume-all)
    // ══════════════════════════════════════════════════════════════════════════

    public record BulkResult(String action, int matched, int succeeded, List<String> failures) {}

    @PostMapping("/bulk/{action}")
    public ApiResponse<BulkResult> bulk(@PathVariable String action) {
        Optional<IngestionBulkAction> parsed = IngestionBulkAction.fromPath(action);
        if (parsed.isEmpty()) {
            return ApiResponse.error(400, "Unknown bulk action: " + action, (BulkResult) null);
        }
        IngestionBulkAction op = parsed.get();
        List<String> targets = op.targets(trackingService.getAll());
        int ok = 0;
        List<String> failures = new ArrayList<>();
        for (String jobId : targets) {
            try {
                ApiResponse<?> r = switch (op) {
                    case CLEAR_FINISHED -> { trackingService.remove(jobId); yield null; }
                    case RETRY_FAILED   -> rerun(jobId, null);
                    case PAUSE_ALL      -> pause(jobId);
                    case RESUME_ALL     -> resume(jobId);
                };
                if (r == null || r.isSuccess()) {
                    ok++;
                    // The rerun spawns a fresh card; drop the failed one so it isn't retried twice.
                    if (op == IngestionBulkAction.RETRY_FAILED) trackingService.remove(jobId);
                } else {
                    failures.add(jobId + ": " + r.getMessage());
                }
            } catch (Exception e) {
                log.warn("[{}] Bulk {} failed: {}", jobId, op, e.getMessage());
                failures.add(jobId + ": " + e.getMessage());
            }
        }
        log.info("Bulk {} — matched={}, ok={}, failed={}", op, targets.size(), ok, failures.size());
        BulkResult result = new BulkResult(op.name(), targets.size(), ok, failures);
        return ApiResponse.success(ok + " of " + targets.size() + " job(s) updated", result);
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
    public ResponseEntity<?> getHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status) {
        MirrorStatus statusFilter = null;
        if (status != null && !status.isBlank()) {
            try {
                statusFilter = MirrorStatus.valueOf(status.trim().toUpperCase(java.util.Locale.ROOT));
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(Map.of("message", "Unknown status: " + status));
            }
        }
        String like = q == null || q.isBlank()
                ? null
                : "%" + q.trim().toLowerCase(java.util.Locale.ROOT).replace("!", "!!")
                        .replace("%", "!%").replace("_", "!_") + "%";
        var pageable = org.springframework.data.domain.PageRequest.of(
                Math.max(0, page), Math.min(Math.max(1, size), 100),
                Sort.by(Sort.Direction.DESC, "startedAt").and(Sort.by("jobId")));
        var result = jobRepository.searchHistory(statusFilter, like, pageable);

        Set<Long> recordIds = result.getContent().stream()
                .map(IngestionHistoryRow::recordId)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        Map<Long, String> recordNames = recordIds.isEmpty() ? Map.of()
                : recordRepository.findAllById(recordIds).stream()
                        .collect(java.util.stream.Collectors.toMap(r -> r.getId(), r -> r.getName()));

        Map<String, Long> counts = new java.util.LinkedHashMap<>();
        long total = 0;
        for (Object[] row : jobRepository.countGroupedByStatus()) {
            long n = ((Number) row[1]).longValue();
            counts.put(String.valueOf(row[0]), n);
            total += n;
        }
        counts.put("TOTAL", total);

        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("content", result.getContent().stream().map(r -> toHistoryDto(r, recordNames)).toList());
        body.put("page", result.getNumber());
        body.put("size", result.getSize());
        body.put("totalElements", result.getTotalElements());
        body.put("totalPages", result.getTotalPages());
        body.put("counts", counts);
        return ResponseEntity.ok(body);
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
     * Fetch available video/audio formats for a single video URL.
     * If the URL is a playlist/series, returns isPlaylist=true with playlistEntries instead.
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

    /**
     * Fetch all entries for a playlist or series URL.
     * Returns a list of items the user can individually select before downloading.
     * To download selected items, POST their individual URLs to /api/ingestion with uris=[...].
     */
    @GetMapping("/yt/playlist")
    public ApiResponse<YtFormatsResponse> getYtPlaylist(@RequestParam String url) {
        try {
            return ApiResponse.success(ytFormatService.fetchPlaylist(url));
        } catch (Exception e) {
            log.error("Failed to fetch playlist for url={}", url, e);
            return ApiResponse.error(500, "Failed to fetch playlist: " + e.getMessage(), (YtFormatsResponse) null);
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
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(400, e.getMessage(), (java.util.List<FileBrowserItem>) null);
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
            inputGuard.validate(request);
        } catch (IllegalArgumentException | SecurityException e) {
            return ApiResponse.error(400, e.getMessage(), (String) null);
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
    // MIGRATION  (one-time scan)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * One-time migration: scans the stream directory for media files with no DB
     * entry and creates MediaInfo records for each.
     *
     * Returns: { scanned, alreadyPresent, created, failed, failedFiles }
     */
    @PostMapping("/migrate/scan-stream")
    public ResponseEntity<?> migrateStreamFiles() {
        try {
            StreamMigrationService.MigrationReport report = streamMigrationService.scanAndLink();
            return ResponseEntity.ok(report);
        } catch (Exception e) {
            log.error("Stream migration scan failed", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()));
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════════════════════════════════════════

    private Map<String, Object> toHistoryDto(IngestionHistoryRow e, Map<Long, String> recordNames) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("jobId",       e.jobId());
        m.put("status",      e.status());
        m.put("step",        e.step());
        m.put("sourceType",  e.sourceType());
        m.put("uri",         e.uri());
        m.put("fileName",    e.fileName());
        m.put("totalBytes",  e.totalBytes());
        m.put("startedAt",   e.startedAt());
        m.put("completedAt", e.completedAt());
        m.put("failReason",  e.failReason());
        m.put("recordId",    e.recordId());
        if (e.recordId() != null) {
            m.put("recordName", recordNames.get(e.recordId()));
        }
        return m;
    }

    private IngestionRequest cloneRequest(IngestionRequest base, String uri) {
        IngestionRequest r = new IngestionRequest();
        r.setUri(uri);
        r.setFolderName(base.getFolderName());
        r.setUsername(base.getUsername());
        r.setPassword(base.getPassword());
        r.setUrlProtected(Boolean.TRUE.equals(base.getUrlProtected()));
        r.setFileName(base.getFileName());
        r.setExpectedSize(base.getExpectedSize());
        r.setExtract(Boolean.TRUE.equals(base.getExtract()));
        r.setExtractPassword(base.getExtractPassword());
        r.setRename(Boolean.TRUE.equals(base.getRename()));
        r.setVideoITag(base.getVideoITag());
        r.setAudioITag(base.getAudioITag());
        r.setOnlyAudio(Boolean.TRUE.equals(base.getOnlyAudio()));
        r.setVideoQuality(base.getVideoQuality());
        r.setTorrentBase64(base.getTorrentBase64());
        r.setRecordId(base.getRecordId());
        r.setSeason(base.getSeason());
        r.setEpisode(base.getEpisode());
        r.setTrackFilter(base.getTrackFilter());
        r.setReviewTracks(Boolean.TRUE.equals(base.getReviewTracks()));
        r.setLocalFilePath(base.getLocalFilePath());
        r.setPlaylistItems(base.getPlaylistItems());
        return r;
    }

    private IngestionRequest reconstructRequest(IngestionJobEntity entity) {
        IngestionRequest r = new IngestionRequest();
        r.setUri(entity.getUri());
        r.setFolderName(entity.getFolderName());
        r.setFileName(entity.getFileName());
        r.setRecordId(entity.getRecordId());
        r.setSeason(entity.getSeasonNumber());
        r.setEpisode(entity.getEpisodeNumber());
        // Restore the yt-dlp format selection so a DB-sourced rerun keeps the chosen quality
        // instead of falling back to best.
        r.setVideoITag(entity.getVideoITag());
        r.setAudioITag(entity.getAudioITag());
        r.setOnlyAudio(Boolean.TRUE.equals(entity.getOnlyAudio()));
        r.setVideoQuality(entity.getVideoQuality());
        r.setExtract(Boolean.TRUE.equals(entity.getExtract()));
        r.setRename(Boolean.TRUE.equals(entity.getRename()));
        return r;
    }

    /**
     * Map an {@link IngestionRequest} to a re-editable {@link JobParamsDto}, resolving
     * the linked record (best-effort) so the form's autocomplete can be pre-populated.
     * Secrets (URL / archive passwords) are never echoed back.
     */
    private JobParamsDto toParamsDto(IngestionRequest r) {
        RecordAutocompleteDto record = r.getRecordId() != null
                ? recordRepository.findAutocompleteById(r.getRecordId()).orElse(null)
                : null;
        boolean rename = Boolean.TRUE.equals(r.getRename());
        return JobParamsDto.builder()
                .uri(r.getUri())
                .recordId(r.getRecordId())
                .record(record)
                .season(r.getSeason())
                .episode(r.getEpisode())
                .folderName(r.getFolderName())
                .videoITag(r.getVideoITag())
                .audioITag(r.getAudioITag())
                .onlyAudio(Boolean.TRUE.equals(r.getOnlyAudio()))
                .videoQuality(r.getVideoQuality())
                .extract(Boolean.TRUE.equals(r.getExtract()))
                .rename(rename)
                .fileName(rename ? r.getFileName() : null)
                .urlProtected(Boolean.TRUE.equals(r.getUrlProtected()))
                .username(r.getUsername())
                .build();
    }
}
