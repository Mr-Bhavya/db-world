package com.db.dbworld.app.media.ingestion.download;

import com.db.dbworld.app.media.ingestion.model.DownloadResult;
import com.db.dbworld.app.media.ingestion.model.IngestionContext;
import com.db.dbworld.app.media.ingestion.model.SourceMetadata;
import com.db.dbworld.app.media.ingestion.processing.fs.FileStorageService;
import com.db.dbworld.app.media.ingestion.queue.IngestionDownloadQueue;
import com.db.dbworld.app.media.ingestion.store.IngestionJobStore;
import com.db.dbworld.app.media.ingestion.tracking.ProgressSnapshot;
import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import com.db.dbworld.app.media.aria2.Aria2RpcService;
import com.db.dbworld.app.media.aria2.Aria2StatusKeys;
import com.db.dbworld.app.media.aria2.model.Aria2AddDownloadResponse;
import com.db.dbworld.app.media.aria2.model.Aria2StatusParam;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

/**
 * Downloads HTTP/HTTPS/Torrent/Magnet links via Aria2c RPC.
 *
 * How GID tracking works:
 *  1. aria2RpcService.addUri() returns a GID immediately (Aria2 assigns it).
 *  2. The GID is stored in IngestionJobStore so the controller can call
 *     aria2RpcService.pause(gid) / unpause(gid) / forceRemove(gid).
 *  3. Cancel/pause/resume Runnables are also registered in the store so the
 *     controller doesn't need to know which strategy is active.
 *  4. yt-dlp jobs have no GID — pause/resume return 400 from the controller.
 */
@Log4j2
@Component
@RequiredArgsConstructor
public class Aria2DownloadStrategy implements DownloadStrategy {

    private static final int  POLL_INTERVAL_MS  = 2000;
    private static final int  MAX_WAIT_HOURS    = 6;
    private static final long MAX_POLL_ITERATIONS =
            (MAX_WAIT_HOURS * 3600 * 1000L) / POLL_INTERVAL_MS;

    private final Aria2RpcService    aria2RpcService;
    private final FileStorageService fileStorageService;
    private final TrackingService    trackingService;
    private final IngestionJobStore  jobStore;
    private final IngestionDownloadQueue downloadQueue;

    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public boolean supports(SourceMetadata metadata) {
        return "HTTP".equals(metadata.getType()) || "TORRENT".equals(metadata.getType())
                || "TORRENT_FILE".equals(metadata.getType());
    }

    @Override
    public DownloadResult download(IngestionContext ctx) {
        String jobId = ctx.getJobId();
        boolean queued = false;

        try {
            boolean isMagnet = isMagnet(ctx);
            queued = downloadQueue.enqueue(jobId, isMagnet);
            if (queued) {
                ctx.setQueueManaged(true);
                ctx.log("QUEUE", "Waiting for download slot");
                boolean allowed = downloadQueue.awaitTurn(jobId,
                        () -> ctx.isCancelled() || trackingService.isCancelled(jobId));
                if (!allowed) {
                    ctx.log("QUEUE", "Removed from queue due to cancellation");
                    return DownloadResult.failure(jobId, "Cancelled");
                }
                ctx.log("QUEUE", "Download slot acquired");
            }

            trackingService.updateStatus(jobId, com.db.dbworld.app.media.ingestion.tracking.MirrorStatus.DOWNLOADING);
            ctx.setStatus(com.db.dbworld.app.media.ingestion.tracking.MirrorStatus.DOWNLOADING);
            ctx.setCurrentStep(com.db.dbworld.app.media.ingestion.pipeline.PipelineStepType.DOWNLOAD);
            trackingService.updateStep(jobId, com.db.dbworld.app.media.ingestion.pipeline.PipelineStepType.DOWNLOAD);

            fileStorageService.prepareDirectories(ctx);
            Path tempDir = fileStorageService.resolveTempDir(ctx);

            Map<String, Object> options = buildAria2Options(ctx, tempDir);

            Aria2AddDownloadResponse addResponse;
            String torrentBase64 = ctx.getRequest().getTorrentBase64();
            if (torrentBase64 != null && !torrentBase64.isBlank()) {
                ctx.log("ARIA2", "Starting torrent download via .torrent file");
                addResponse = aria2RpcService.addTorrent(jobId, torrentBase64, options);
            } else {
                ctx.log("ARIA2", "Starting download: " + ctx.getRequest().getUri());
                addResponse = aria2RpcService.addUri(jobId, ctx.getRequest().getUri(), options);
            }

            String gid = addResponse.getGid();

            // ── Register GID and actions in the job store ──────────────────
            jobStore.setGid(jobId, gid);
            jobStore.setCancelAction(jobId, () -> {
                try {
                    jobStore.getGid(jobId).ifPresent(aria2RpcService::forceRemove);
                } catch (Exception e) {
                    log.warn("[{}] forceRemove failed: {}", jobId, e.getMessage());
                } finally {
                    downloadQueue.cancel(jobId);
                }
            });
            jobStore.setPauseAction(jobId, () ->
                    jobStore.getGid(jobId).ifPresent(g -> {
                        try { aria2RpcService.pause(g); }
                        catch (Exception e) { log.warn("[{}] pause failed: {}", jobId, e.getMessage()); }
                    })
            );
            jobStore.setResumeAction(jobId, () ->
                    jobStore.getGid(jobId).ifPresent(g -> {
                        try { aria2RpcService.unpause(g); }
                        catch (Exception e) { log.warn("[{}] unpause failed: {}", jobId, e.getMessage()); }
                    })
            );

            // ──────────────────────────────────────────────────────────────

            ctx.log("ARIA2", "Download queued with GID: " + gid);
            return pollUntilDone(ctx, gid, tempDir);

        } catch (Exception e) {
            log.error("[{}] Aria2 download failed", jobId, e);
            ctx.logError("ARIA2", "Download failed: " + e.getMessage());
            return DownloadResult.failure(jobId, e.getMessage());
        }
    }

    @Override
    public void cancel(String jobId) {
        jobStore.executeCancelAction(jobId);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Options builder
    // ──────────────────────────────────────────────────────────────────────────

    private Map<String, Object> buildAria2Options(IngestionContext ctx, Path tempDir) {
        Map<String, Object> options = new HashMap<>();
        options.put("dir", tempDir.toAbsolutePath().toString());

        if (ctx.getRequest().getUrlProtected()) {
            options.put("http-user", ctx.getRequest().getUsername());
            options.put("http-passwd", ctx.getRequest().getPassword());
        }

        return options;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Polling loop
    // ──────────────────────────────────────────────────────────────────────────

    private static final int MAX_CONSECUTIVE_POLL_ERRORS = 5;

    private DownloadResult pollUntilDone(IngestionContext ctx, String gid, Path tempDir)
            throws InterruptedException {
        String jobId = ctx.getJobId();
        long iterations = 0;
        int consecutiveErrors = 0;

        while (iterations < MAX_POLL_ITERATIONS) {

            if (ctx.isCancelled() || trackingService.isCancelled(jobId)) {
                jobStore.executeCancelAction(jobId);
                ctx.log("ARIA2", "Download cancelled");
                return DownloadResult.failure(jobId, "Cancelled");
            }

            Thread.sleep(POLL_INTERVAL_MS);
            iterations++;

            String activeGid = null;

            try {

                activeGid = jobStore.getGid(jobId).orElse(null);
                if (activeGid == null) {
                    return DownloadResult.failure(jobId, "Missing active GID");
                }

                Aria2StatusParam status = aria2RpcService.tellStatus(activeGid);

                if (status == null) {
                    ctx.logError("ARIA2", "Null status for GID: " + activeGid);
                    continue;
                }

                consecutiveErrors = 0;

                updateProgress(ctx, status);

                String aria2Status = status.getStatus();

                if ("complete".equals(aria2Status)) {
                    // The default tellStatus payload uses BASIC_KEYS — no
                    // `bittorrent` and no `followedBy`. isMetadataDownload()
                    // checks both, so without them every torrent's metadata-
                    // download GID looked like a real completion and FFmpeg
                    // got fired on the 239-byte .torrent / control file
                    // before the actual payload had even started. Re-fetch
                    // with FINAL_STATUS_KEYS here so the metadata check has
                    // the fields it needs. One extra RPC per torrent — rare
                    // event, dwarfed by the actual download time.
                    Aria2StatusParam complete = aria2RpcService.tellStatus(
                            activeGid, Aria2StatusKeys.FINAL_STATUS_KEYS);
                    Aria2StatusParam effective = complete != null ? complete : status;

                    if (effective.isMetadataDownload()) {
                        ctx.log("ARIA2", "Metadata complete, waiting for actual payload download...");
                        // The WS handler observes the same onDownloadComplete
                        // event and remaps jobStore's GID to followedBy[0],
                        // so the next poll iteration picks up the real GID.
                        continue;
                    }
                    return handleComplete(ctx, activeGid, effective, tempDir);
                }

                if ("error".equals(aria2Status)) {
                    String msg = status.getErrorMessage() != null
                            ? status.getErrorMessage()
                            : "Aria2 error (code " + status.getErrorCode() + ")";
                    ctx.logError("ARIA2", "Error: " + msg);
                    return DownloadResult.failure(jobId, msg);
                }

                if ("removed".equals(aria2Status)) {
                    ctx.log("ARIA2", "Download removed");
                    return DownloadResult.failure(jobId, "Removed");
                }
                // "paused" → keep polling until resume or cancel

            } catch (Exception e) {
                consecutiveErrors++;
                log.warn("[{}] Poll error #{} for GID {}: {}", jobId, consecutiveErrors, activeGid, e.getMessage());
                if (consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
                    String msg = "Aria2 RPC unreachable after " + consecutiveErrors + " retries: " + e.getMessage();
                    ctx.logError("ARIA2", msg);
                    return DownloadResult.failure(jobId, msg);
                }
            }
        }

        jobStore.executeCancelAction(jobId);
        return DownloadResult.failure(jobId,
                "Timed out after " + MAX_WAIT_HOURS + " hours");
    }

    private DownloadResult handleComplete(IngestionContext ctx, String gid,
                                          Aria2StatusParam status, Path tempDir) {
        String jobId = ctx.getJobId();
        log.info("[{}] Aria2 download complete — GID: {}", jobId, gid);
        ctx.log("ARIA2", "Complete (GID: " + gid + ")");

        Path downloadedFile = resolveDownloadedFile(status, tempDir);

        if (downloadedFile == null || !Files.exists(downloadedFile)) {
            log.error("[{}] Aria2 reported complete but file missing in {}", jobId, tempDir);
            ctx.logError("ARIA2", "Downloaded file missing in: " + tempDir);
            return DownloadResult.failure(jobId, "File missing after download");
        }

        try {
            long size = Files.size(downloadedFile);
            log.info("[{}] Aria2 file ready — {} ({} bytes)", jobId, downloadedFile.getFileName(), size);
            ctx.log("ARIA2", "File ready: " + downloadedFile.getFileName() + " (" + size + " bytes)");

            DownloadResult result = DownloadResult.success(
                    jobId, downloadedFile, downloadedFile.getFileName().toString(), size);
            result.setGid(gid);
            return result;

        } catch (Exception e) {
            log.error("[{}] Error reading downloaded file size for {}", jobId, downloadedFile, e);
            return DownloadResult.failure(jobId, "Error reading file: " + e.getMessage());
        }
    }

    private Path resolveDownloadedFile(Aria2StatusParam status, Path tempDir) {
        if (status.getFiles() != null && !status.getFiles().isEmpty()) {
            String fp = status.getFiles().getFirst().getPath();
            if (fp != null && !fp.isBlank()) {
                Path p = Paths.get(fp);
                if (Files.exists(p)) return p;
            }
        }
        // Fallback: most-recently-modified file in temp dir
        try {
            if (Files.isDirectory(tempDir)) {
                try (var stream = Files.list(tempDir)) {
                    return stream
                            .filter(Files::isRegularFile)
                            .max((a, b) -> {
                                try {
                                    return Files.getLastModifiedTime(a)
                                               .compareTo(Files.getLastModifiedTime(b));
                                } catch (Exception e) { return 0; }
                            })
                            .orElse(null);
                }
            }
        } catch (Exception e) {
            log.warn("Error scanning temp dir: {}", e.getMessage());
        }
        return null;
    }

    private void updateProgress(IngestionContext ctx, Aria2StatusParam status) {
        try {
            Long total     = status.getTotalLength();
            Long completed = status.getCompletedLength();
            Long speed     = status.getDownloadSpeed();

            if (total != null && total > 0 && completed != null) {
                long remaining = total - completed;
                long eta = (speed != null && speed > 0) ? remaining / speed : 0;
                trackingService.updateProgress(ctx.getJobId(),
                        ProgressSnapshot.downloading(completed, total,
                                speed != null ? speed.doubleValue() : 0.0, eta));
            }
        } catch (Exception e) {
            log.debug("[{}] updateProgress skipped: {}", ctx.getJobId(), e.getMessage());
        }
    }

    private boolean isMagnet(IngestionContext ctx) {
        if (ctx.getSource() == null || ctx.getSource().getAttributes() == null) return false;
        Object flag = ctx.getSource().getAttributes().get("isMagnet");
        return flag != null && Boolean.parseBoolean(flag.toString());
    }
}
