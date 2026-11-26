package com.db.dbworld.app.media.ingestion.download;

import com.db.dbworld.app.media.ingestion.model.DownloadResult;
import com.db.dbworld.app.media.ingestion.model.IngestionContext;
import com.db.dbworld.app.media.ingestion.model.SourceMetadata;
import com.db.dbworld.app.media.ingestion.processing.fs.FileStorageService;
import com.db.dbworld.app.media.ingestion.queue.IngestionDownloadQueue;
import com.db.dbworld.app.media.ingestion.store.IngestionJobStore;
import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import com.db.dbworld.app.media.aria2.Aria2ErrorCodes;
import com.db.dbworld.app.media.aria2.Aria2RpcService;
import com.db.dbworld.app.media.aria2.Aria2Progress;
import com.db.dbworld.app.media.aria2.Aria2StatusKeys;
import com.db.dbworld.app.media.aria2.model.Aria2AddDownloadResponse;
import com.db.dbworld.app.media.aria2.model.Aria2File;
import com.db.dbworld.app.media.aria2.model.Aria2StatusParam;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

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
            String adoptGid = ctx.getRequest().getAdoptGid();
            if (adoptGid != null && !adoptGid.isBlank()) {
                return adoptExisting(ctx, adoptGid);
            }

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
                // A released ("Run now") job bypassed the slot — carry that onto the ctx so the
                // pipeline lets it bypass the serial processing cap too (full parallel).
                ctx.setParallel(downloadQueue.isParallel(jobId));
                ctx.log("QUEUE", ctx.isParallel() ? "Running in parallel (released)" : "Download slot acquired");
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

            registerGidActions(jobId, gid);

            if (ctx.isParallel()) {
                try {
                    aria2RpcService.startParallelDownload(gid);
                } catch (Exception e) {
                    jobStore.executeCancelAction(jobId);
                    throw e;
                }
            }

            ctx.log("ARIA2", "Download queued with GID: " + gid);
            return pollUntilDone(ctx, gid, tempDir);

        } catch (Exception e) {
            // pollUntilDone sleeps between polls, so a cancel arrives as an interrupt here.
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.error("[{}] Aria2 download failed", jobId, e);
            String why = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            ctx.logError("ARIA2", "Download failed: " + why);
            return DownloadResult.failure(jobId, why);
        }
    }

    /**
     * Restart recovery: aria2 still owns this download (active/waiting/paused), so track the existing
     * GID instead of adding the URI again — re-adding would start a second copy into the same dir.
     * aria2 already orders it in its own queue, so it skips the app download slot like a magnet.
     */
    private DownloadResult adoptExisting(IngestionContext ctx, String gid) throws InterruptedException {
        String jobId = ctx.getJobId();
        trackingService.updateStatus(jobId, com.db.dbworld.app.media.ingestion.tracking.MirrorStatus.DOWNLOADING);
        ctx.setStatus(com.db.dbworld.app.media.ingestion.tracking.MirrorStatus.DOWNLOADING);
        ctx.setCurrentStep(com.db.dbworld.app.media.ingestion.pipeline.PipelineStepType.DOWNLOAD);
        trackingService.updateStep(jobId, com.db.dbworld.app.media.ingestion.pipeline.PipelineStepType.DOWNLOAD);

        fileStorageService.prepareDirectories(ctx);
        Path tempDir = fileStorageService.resolveTempDir(ctx);

        registerGidActions(jobId, gid);
        // surfaceExternalDownloads may have shown this GID as a synthetic job before we claimed it.
        String syntheticId = "ext-" + gid;
        if (trackingService.hasJob(syntheticId)) trackingService.remove(syntheticId);
        ctx.log("ARIA2", "Adopted existing aria2 download with GID: " + gid);
        return pollUntilDone(ctx, gid, tempDir);
    }

    private void registerGidActions(String jobId, String gid) {
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
        // A re-download after a stop/cancel lands on the same deterministic temp path. Resume from a
        // leftover .aria2 control file when there is one; otherwise overwrite the stale partial file
        // instead of failing with "file already exists" (13) or silently renaming it to name.1.ext.
        options.put("continue", "true");
        options.put("allow-overwrite", "true");
        options.put("auto-file-renaming", "false");

        if (Boolean.TRUE.equals(ctx.getRequest().getUrlProtected())) {
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
        int consecutiveErrors = 0;

        while (true) {

            if (ctx.isCancelled() || trackingService.isCancelled(jobId)) {
                return cancelAndDiscard(ctx, tempDir);
            }

            try {
                Thread.sleep(POLL_INTERVAL_MS);
            } catch (InterruptedException e) {
                // A cancel interrupts the sleeping poller; tidy up before giving the interrupt back.
                if (ctx.isCancelled() || trackingService.isCancelled(jobId)) {
                    DownloadResult cancelled = cancelAndDiscard(ctx, tempDir);
                    Thread.currentThread().interrupt();
                    return cancelled;
                }
                throw e;
            }

            String activeGid = null;

            try {

                activeGid = jobStore.getGid(jobId).orElse(null);
                if (activeGid == null) {
                    return DownloadResult.failure(jobId, "Missing active GID");
                }

                Aria2StatusParam status = aria2RpcService.tellStatus(activeGid, Aria2StatusKeys.POLL_KEYS);

                if (status == null) {
                    ctx.logError("ARIA2", "Null status for GID: " + activeGid);
                    throw new IllegalStateException("Null aria2 status for GID " + activeGid);
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
                    String msg = Aria2ErrorCodes.describe(status.getErrorCode(), status.getErrorMessage());
                    ctx.logError("ARIA2", "Error: " + msg);
                    // Keep partial data so a retry can resume, but free the GID for a clean re-add.
                    aria2RpcService.removeDownloadResult(activeGid);
                    return DownloadResult.failure(jobId, msg);
                }

                if ("removed".equals(aria2Status)) {
                    if (ctx.isCancelled() || trackingService.isCancelled(jobId)) {
                        return cancelAndDiscard(ctx, tempDir);
                    }
                    ctx.log("ARIA2", "Download removed");
                    aria2RpcService.removeDownloadResult(activeGid);
                    return DownloadResult.failure(jobId, "Download was removed from aria2 outside the app");
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

    }

    /**
     * User cancel: stop aria2, then queue the partial download (file or torrent folder) and its
     * .aria2 control file for the pipeline's temp cleanup, so a later re-download starts clean.
     */
    private DownloadResult cancelAndDiscard(IngestionContext ctx, Path tempDir) {
        String jobId = ctx.getJobId();
        String gid = jobStore.getGid(jobId).orElse(null);
        if (gid != null && tempDir != null) {
            ctx.getTempArtifacts().addAll(partialArtifacts(gid, tempDir));
        }
        jobStore.executeCancelAction(jobId);
        if (gid != null) {
            aria2RpcService.removeDownloadResult(gid);
        }
        ctx.log("ARIA2", "Download cancelled");
        return DownloadResult.failure(jobId, "Cancelled");
    }

    /** Top-level entries this download wrote under tempDir, plus their .aria2 control files. */
    List<Path> partialArtifacts(String gid, Path tempDir) {
        Set<Path> out = new LinkedHashSet<>();
        Path root = tempDir.toAbsolutePath().normalize();
        try {
            Aria2StatusParam s = aria2RpcService.tellStatus(gid, Aria2StatusKeys.FILES_KEYS);
            List<Aria2StatusParam> statuses = new ArrayList<>();
            if (s != null) statuses.add(s);
            if (s != null && s.getFollowedBy() != null) {
                for (String follower : s.getFollowedBy()) {
                    Aria2StatusParam f = aria2RpcService.tellStatus(follower, Aria2StatusKeys.FILES_KEYS);
                    if (f != null) statuses.add(f);
                }
            }
            for (Aria2StatusParam st : statuses) {
                if (st.getFiles() == null) continue;
                for (Aria2File file : st.getFiles()) {
                    if (file == null || file.getPath() == null || file.getPath().isBlank()
                            || file.getPath().startsWith("[METADATA]")) continue;
                    Path p = Paths.get(file.getPath()).toAbsolutePath().normalize();
                    if (!p.startsWith(root) || p.equals(root)) continue;
                    Path top = root.resolve(root.relativize(p).getName(0));
                    out.add(top);
                    out.add(top.resolveSibling(top.getFileName() + ".aria2"));
                }
            }
        } catch (Exception e) {
            log.debug("Could not list partial files for GID {}: {}", gid, e.getMessage());
        }
        return new ArrayList<>(out);
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
            long size = sizeOf(downloadedFile);
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
        // Multi-file torrent (e.g. a season pack): return the whole temp directory so
        // FfmpegProcessingStrategy.processDirectory() walks and processes every episode,
        // instead of just the first file.
        if (status.getFiles() != null && status.getFiles().size() > 1) {
            return tempDir;
        }
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

    /** Total size of a file, or the summed size of all regular files when given a directory. */
    private long sizeOf(Path p) {
        try {
            if (!Files.isDirectory(p)) return Files.size(p);
            try (var s = Files.walk(p)) {
                return s.filter(Files::isRegularFile)
                        .mapToLong(f -> { try { return Files.size(f); } catch (Exception e) { return 0L; } })
                        .sum();
            }
        } catch (Exception e) {
            return 0L;
        }
    }

    private void updateProgress(IngestionContext ctx, Aria2StatusParam status) {
        try {
            trackingService.updateProgress(ctx.getJobId(), Aria2Progress.from(status));
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
