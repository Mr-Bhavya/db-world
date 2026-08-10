package com.db.dbworld.app.media.ingestion.pipeline;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalog.service.CatalogService;
import com.db.dbworld.app.media.enrichment.SmartTrackFilterService;
import com.db.dbworld.app.media.enrichment.TrackFilter;
import com.db.dbworld.app.media.ingestion.model.*;
import com.db.dbworld.app.media.ingestion.persistence.IngestionRepository;
import com.db.dbworld.app.media.ingestion.queue.IngestionDownloadQueue;
import com.db.dbworld.app.media.ingestion.spi.*;
import com.db.dbworld.app.media.ingestion.store.IngestionJobStore;
import com.db.dbworld.app.media.ingestion.tracking.*;
import com.db.dbworld.app.media.ingestion.tracking.log.LogCollector;
import com.db.dbworld.core.push.PushService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.apache.logging.log4j.ThreadContext;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

@Log4j2
@RequiredArgsConstructor
public class DefaultIngestionPipeline implements IngestionPipeline {

    /**
     * Max FFmpeg/processing jobs running at once. 1 = strictly serial — only one job processes at a
     * time; every other job waits for this slot. (A manually-released "Run now" job can still
     * download in parallel via the download queue.)
     */
    private static final int MAX_CONCURRENT_PROCESSING = 1;

    private final List<SourceHandler>    sourceHandlers;
    private final List<DownloadStrategy> downloadStrategies;
    private final List<ProcessingStrategy> processors;

    private final TrackingService    trackingService;

    /** Caps total simultaneous processing (FFmpeg) jobs across all records. */
    private final Semaphore globalProcessingSemaphore = new Semaphore(MAX_CONCURRENT_PROCESSING);

    /**
     * Per-record semaphore: only one FFmpeg process at a time for a given record.
     * Jobs for the same record queue here rather than failing immediately.
     */
    private final ConcurrentHashMap<Long, Semaphore> recordLocks = new ConcurrentHashMap<>();

    private final IngestionRepository repository;
    private final ExecutorService    jobExecutor;
    private final IngestionJobStore  jobStore;
    private final IngestionDownloadQueue downloadQueue;
    private final RecordRepository   recordRepository;
    private final PushService        pushService;
    private final CatalogService     catalogService;

    // Interactive audio/subtitle track review (opt-in per job).
    private final SmartTrackFilterService smartTrackFilterService;
    private final TrackReviewCoordinator  trackReviewCoordinator;
    private final SettingsService         settingsService;

    /** Container extensions considered "media" when picking a representative file to probe. */
    private static final Set<String> MEDIA_EXTENSIONS = Set.of(
            "mkv", "mp4", "avi", "mov", "ts", "m2ts", "m4v", "wmv", "flv", "webm", "mpg", "mpeg");

    /** Archive extensions treated as "extract me first" (a magic-byte sniff also covers renamed files). */
    private static final Set<String> ARCHIVE_EXTENSIONS = Set.of(
            "zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz", "cbz", "cbr");

    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public String start(IngestionRequest request) {
        String jobId = UUID.randomUUID().toString();
        log.debug("start jobId={} uri={} recordId={} localFilePath={}",
                jobId,
                request != null ? request.getUri() : null,
                request != null ? request.getRecordId() : null,
                request != null ? request.getLocalFilePath() : null);

        IngestionContext ctx = new IngestionContext();
        ctx.setJobId(jobId);
        ctx.setRequest(request);
        ctx.setStatus(MirrorStatus.QUEUED);
        ctx.setLogCollector(new LogCollector());
        ctx.setRecordId(request.getRecordId());
        ctx.setStartedAt(Instant.now());

        jobStore.register(jobId, request);
        trackingService.updateStatus(jobId, MirrorStatus.QUEUED);
        ctx.setLogCollector(trackingService.getLogCollector(jobId));

        notifyAdmins("Ingestion queued", resolveRecordName(request.getRecordId()), request);

        log.info("[{}] Pipeline submitted — uri={}, recordId={}",
                jobId,
                request != null ? request.getUri() : null,
                request != null ? request.getRecordId() : null);

        jobExecutor.submit(() -> execute(ctx));
        return jobId;
    }

    // ──────────────────────────────────────────────────────────────────────────

    private String resolveRecordName(Long recordId) {
        if (recordId == null) return null;
        try {
            return recordRepository.findById(recordId)
                    .map(r -> r.getName())
                    .orElse(null);
        } catch (Exception e) {
            log.warn("Could not resolve record name for id={}: {}", recordId, e.getMessage());
            return null;
        }
    }

    // ──────────────────────────────────────────────────────────────────────────

    private void execute(IngestionContext ctx) {
        String jobId = ctx.getJobId();
        ThreadContext.put("traceId", "job-" + jobId);
        final String recordName = resolveRecordName(ctx.getRequest().getRecordId());
        try {
            trackingService.updateStatus(jobId, MirrorStatus.STARTED);
            ctx.setStatus(MirrorStatus.STARTED);
            ctx.log("PIPELINE", "Job started: " + jobId);
            log.info("[{}] Pipeline execute START — recordName={}, recordId={}",
                    jobId, recordName, ctx.getRequest().getRecordId());

            // ── Local file shortcut (link-existing) ──────────────────────────
            String localFilePath = ctx.getRequest().getLocalFilePath();
            if (localFilePath != null && !localFilePath.isBlank()) {
                Path localFile = Path.of(localFilePath);
                if (!Files.exists(localFile)) {
                    throw new RuntimeException("Local file not found: " + localFilePath);
                }
                SourceMetadata src = new SourceMetadata();
                src.setType("LOCAL");
                src.setUri(localFilePath);
                ctx.setSource(src);
                jobStore.setSourceType(jobId, "LOCAL");

                DownloadResult localResult = DownloadResult.success(
                        jobId, localFile, localFile.getFileName().toString(), Files.size(localFile));
                ctx.setDownload(localResult);

                trackingService.updateJobMeta(jobId, "LOCAL",
                        localFile.getFileName().toString(), localFilePath,
                        ctx.getRequest().getRecordId(), recordName);
                ctx.log("SOURCE", "Using local file: " + localFile.getFileName());
                runProcessing(ctx, recordName);
                return;
            }

            // ── Resolve source ───────────────────────────────────────────────
            SourceHandler handler = sourceHandlers.stream()
                    .filter(h -> h.supports(ctx.getRequest().getUri()))
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException(
                            "No source handler for URI: " + ctx.getRequest().getUri()));

            ctx.setSource(handler.resolve(ctx.getRequest().getUri()));
            jobStore.setSourceType(jobId, ctx.getSource().getType());
            ctx.log("SOURCE", "Resolved source type: " + ctx.getSource().getType());

            trackingService.updateJobMeta(jobId, ctx.getSource().getType(),
                    null, ctx.getRequest().getUri(), ctx.getRequest().getRecordId(), recordName);

            if (isCancelled(ctx)) { markCancelled(ctx); return; }

            // ── Download ─────────────────────────────────────────────────────
            DownloadStrategy downloader = downloadStrategies.stream()
                    .filter(d -> d.supports(ctx.getSource()))
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException(
                            "No download strategy for source: " + ctx.getSource().getType()));

            // Each download strategy owns the DOWNLOADING transition and fires it at the moment the
            // transfer actually begins: aria2 only after it acquires the sequential download slot (a
            // job still waiting for the slot stays QUEUED), yt-dlp immediately since it never queues.
            // Setting DOWNLOADING here — before the strategy ran — made a job that is genuinely
            // waiting in the HTTP queue read as "Downloading", and the queue's QUEUED correction was
            // then dropped as an illegal DOWNLOADING→QUEUED transition.
            DownloadResult downloadResult = downloader.download(ctx);
            ctx.setDownload(downloadResult);

            if (!downloadResult.isSuccess()) {
                if (isCancelled(ctx) || "Cancelled".equalsIgnoreCase(downloadResult.getErrorMessage())) {
                    markCancelled(ctx);
                    return;
                }
                throw new RuntimeException("Download failed: " + downloadResult.getErrorMessage());
            }

            trackingService.updateJobMeta(jobId, ctx.getSource().getType(),
                    downloadResult.getFileName(), ctx.getRequest().getUri(),
                    ctx.getRequest().getRecordId(), recordName);

            ctx.log("DOWNLOAD", "Completed: " + downloadResult.getFileName());

            // Track a downloaded FILE (single media, or an archive before extraction) for temp cleanup
            // on job end. Directories (torrent packs) share the record's temp dir, so we don't queue
            // those for deletion here; local-file (link-existing) jobs skip this section entirely.
            if (downloadResult.getFilePath() != null && Files.isRegularFile(downloadResult.getFilePath())) {
                ctx.getTempArtifacts().add(downloadResult.getFilePath());
            }

            if (isCancelled(ctx)) { markCancelled(ctx); return; }

            runProcessing(ctx, recordName);

        } catch (Exception e) {
            if (isCancelled(ctx)) {
                markCancelled(ctx);
                return;
            }
            log.error("Pipeline failed for jobId={}", jobId, e);
            ctx.logError("PIPELINE", "Job failed: " + e.getMessage());
            ctx.setStatus(MirrorStatus.FAILED);
            ctx.setMessage(e.getMessage());
            trackingService.fail(jobId, e.getMessage());
            ctx.setHtmlReport(trackingService.getHtmlReport(jobId));
            safeRepositorySave(ctx);
            notifyAdmins("Ingestion failed", recordName, ctx.getRequest());
        } finally {
            cleanupTempArtifacts(ctx);
            if (ctx.isQueueManaged()) {
                downloadQueue.signalComplete(jobId);
            }
            jobStore.remove(jobId);
            log.debug("[{}] Pipeline execute END", jobId);
            ThreadContext.clearAll();
        }
    }

    private void runProcessing(IngestionContext ctx, String recordName) throws Exception {
        String  jobId     = ctx.getJobId();

        // ── Archive preparation ──────────────────────────────────────────────────
        // If the download is an archive, extract it BEFORE the track-review probe so the probe (and
        // the later FFmpeg pass) see the real media files, and the one selection applies to them all.
        maybePrepareArchive(ctx);
        if (isCancelled(ctx)) { markCancelled(ctx); return; }

        // ── Interactive track-review gate ────────────────────────────────────────
        // Runs BEFORE any processing slot is acquired and after the download slot is released, so a
        // job parked here waiting for the admin holds no slot and other jobs keep flowing.
        maybeAwaitTrackReview(ctx);
        if (isCancelled(ctx)) { markCancelled(ctx); return; }

        Long    recordId  = ctx.getRecordId();

        Semaphore recordLock = recordId != null
                ? recordLocks.computeIfAbsent(recordId, k -> new Semaphore(1))
                : null;

        // Serial processing: only one job holds this slot at a time (cap = MAX_CONCURRENT_PROCESSING).
        // A manually-released ("Run now") job bypasses the slot so ONLY it runs in parallel.
        boolean parallel = ctx.isParallel();
        if (!parallel && !tryAcquireSlot(globalProcessingSemaphore, ctx, "global processing slot")) return;
        try {
            // Acquire per-record slot — serialises same-record jobs
            if (recordLock != null && !tryAcquireSlot(recordLock, ctx, "per-record processing slot")) {
                return; // finally will release globalProcessingSemaphore
            }
            try {
                trackingService.updateStatus(jobId, MirrorStatus.PROCESSING);
                ctx.setStatus(MirrorStatus.PROCESSING);

                // A multi-file job (zip / folder / torrent pack) has a DIRECTORY as its download path;
                // keep the folder/archive name as the job's display name rather than overwriting it to
                // the last processed file (the per-file breakdown already lists each file).
                final boolean multiFile = ctx.getDownload() != null
                        && ctx.getDownload().getFilePath() != null
                        && Files.isDirectory(ctx.getDownload().getFilePath());

                for (ProcessingStrategy processor : processors) {
                    if (!processor.supports(ctx)) continue;

                    ctx.log("PROCESS", "Running: " + processor.getClass().getSimpleName());
                    updateStep(ctx, resolveStep(processor));

                    ProcessingResult result = processor.process(ctx);
                    ctx.setProcessing(result);

                    if (!result.isSuccess()) {
                        ctx.logError("PROCESS", "Failed: " + result.getErrorMessage());
                        throw new RuntimeException("Processing failed: " + result.getErrorMessage());
                    }

                    if (result.getFinalFile() != null) {
                        if (ctx.getDownload() != null) {
                            ctx.getDownload().setFilePath(result.getFinalFile());
                        }
                        // Single-file job → its display name is the final output file. Multi-file job
                        // → keep the folder/archive name already set right after download.
                        if (!multiFile) {
                            String finalFileName = result.getFinalFile().getFileName().toString();
                            trackingService.updateJobMeta(jobId,
                                    ctx.getSource() != null ? ctx.getSource().getType() : null,
                                    finalFileName,
                                    ctx.getRequest() != null ? ctx.getRequest().getUri() : null,
                                    ctx.getRecordId(), recordName);
                            if (ctx.getDownload() != null) {
                                ctx.getDownload().setFileName(finalFileName);
                            }
                        }
                    }

                    if (isCancelled(ctx)) { markCancelled(ctx); return; }
                }

                ctx.setStatus(MirrorStatus.SUCCESS);
                ctx.log("PIPELINE", "Job completed successfully");
                trackingService.complete(jobId);
                ctx.setHtmlReport(trackingService.getHtmlReport(jobId));
                repository.save(ctx);
                notifyAdmins("Ingestion complete", recordName, ctx.getRequest());
                // Media is now attached: auto-publish the record (if enabled) and fire the deferred
                // "new title" push. Best-effort — onMediaIngested swallows its own failures.
                catalogService.onMediaIngested(ctx.getRecordId());
            } finally {
                if (recordLock != null) recordLock.release();
            }
        } finally {
            if (!parallel) globalProcessingSemaphore.release();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Archive preparation
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * If the download is a single archive file (auto-detected by magic bytes, or the request opted
     * into {@code extract}), extract it NOW — before the track-review probe — so the probe and the
     * later FFmpeg pass see the real media files rather than the opaque archive. Reuses the existing
     * ExtractionProcessingStrategy; that strategy is then skipped in the processors loop (guarded on
     * {@code archiveExtracted}). Torrent packs / playlists already arrive as a directory of media,
     * so they're left untouched (the directory-aware probe handles them directly).
     */
    private void maybePrepareArchive(IngestionContext ctx) throws Exception {
        if (ctx.getDownload() == null || ctx.getDownload().getFilePath() == null) return;
        Path file = ctx.getDownload().getFilePath();
        if (!Files.isRegularFile(file)) return; // directory (torrent pack/playlist) — nothing to unpack

        boolean wantExtract = Boolean.TRUE.equals(ctx.getRequest().getExtract()) || isArchive(file);
        if (!wantExtract) return;

        ProcessingStrategy extractor = processors.stream()
                .filter(p -> p.getClass().getSimpleName().toLowerCase().contains("extract"))
                .findFirst().orElse(null);
        if (extractor == null) {
            ctx.logError("EXTRACT", "Archive detected but no extraction strategy is available");
            return;
        }

        // Extraction is I/O + CPU heavy, so cap it with the global processing slot — but release the
        // slot right after (finally) so the track-review wait never sits on it. A released ("Run now")
        // job bypasses the slot (it runs in parallel).
        boolean parallel = ctx.isParallel();
        if (!parallel && !tryAcquireSlot(globalProcessingSemaphore, ctx, "archive extraction slot")) return;
        try {
            // Keep the status where it is (DOWNLOADING) and only advance the STEP to EXTRACT — moving
            // to PROCESSING here would make the later AWAITING_INPUT transition illegal.
            updateStep(ctx, PipelineStepType.EXTRACT);
            // Clear the stale download snapshot (still at 100%) so the UI shows an indeterminate
            // "Extracting…" bar rather than a bogus 100% — 7z's cursor progress isn't reliably parsed
            // cross-platform (Windows uses backspaces that readLine can't split into % updates).
            trackingService.updateProgress(ctx.getJobId(), ProgressSnapshot.processing());
            ctx.log("EXTRACT", "Archive detected — extracting before track detection");
            ProcessingResult result = extractor.process(ctx);
            if (!result.isSuccess()) {
                throw new RuntimeException("Extraction failed: " + result.getErrorMessage());
            }
            if (result.getFinalFile() != null) {
                ctx.getDownload().setFilePath(result.getFinalFile());
                ctx.getDownload().setFileName(result.getFinalFile().getFileName().toString());
            }
            ctx.setArchiveExtracted(true);
            ctx.getTempArtifacts().add(result.getFinalFile()); // extract dir — removed when the job ends
            ctx.log("EXTRACT", "Extraction done — processing extracted files");
        } finally {
            if (!parallel) globalProcessingSemaphore.release();
        }
    }

    /** True if the file looks like an archive we should unpack — magic-byte sniff, extension fallback. */
    private boolean isArchive(Path file) {
        try (var in = Files.newInputStream(file)) {
            byte[] h = in.readNBytes(8);
            if (h.length >= 4) {
                int b0 = h[0] & 0xFF, b1 = h[1] & 0xFF, b2 = h[2] & 0xFF, b3 = h[3] & 0xFF;
                if (b0 == 'P' && b1 == 'K' && (b2 == 3 || b2 == 5 || b2 == 7)) return true;   // zip / ooxml
                if (b0 == 0x37 && b1 == 0x7A && b2 == 0xBC && b3 == 0xAF) return true;         // 7z
                if (b0 == 'R' && b1 == 'a' && b2 == 'r' && b3 == '!') return true;             // rar
                if (b0 == 0x1F && b1 == 0x8B) return true;                                     // gzip / tgz
                if (b0 == 0xFD && b1 == 0x37 && b2 == 0x7A && b3 == 0x58) return true;         // xz
                if (b0 == 'B' && b1 == 'Z' && b2 == 'h') return true;                          // bzip2
            }
        } catch (Exception e) {
            log.debug("isArchive sniff failed for {}: {}", file, e.getMessage());
        }
        return hasArchiveExtension(file); // tar's magic sits at offset 257 — trust the extension for it
    }

    private boolean hasArchiveExtension(Path file) {
        String name = file.getFileName().toString().toLowerCase();
        int dot = name.lastIndexOf('.');
        return dot > 0 && ARCHIVE_EXTENSIONS.contains(name.substring(dot + 1));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Interactive track review
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * If this job opted into track review, probe the downloaded file, enter {@code AWAITING_INPUT}
     * and park until the admin picks tracks (or the timeout applies the smart default). The chosen
     * (or default) {@link TrackFilter} is set back on the request so the FFmpeg pass applies it.
     * Best-effort: any probe/skip condition just proceeds with the normal smart-resolve behaviour.
     */
    private void maybeAwaitTrackReview(IngestionContext ctx) throws InterruptedException {
        String jobId = ctx.getJobId();
        if (!Boolean.TRUE.equals(ctx.getRequest().getReviewTracks())) return;
        if (!settingsService.getBoolean(ConfigKeys.INGESTION_TRACK_REVIEW_ENABLED)) {
            ctx.log("TRACKS", "Track review requested but disabled in settings — using smart default");
            return;
        }
        if (ctx.getDownload() == null || ctx.getDownload().getFilePath() == null) return;
        if (isCancelled(ctx)) return;

        Path probeTarget = resolveProbeTarget(ctx.getDownload().getFilePath());
        if (probeTarget == null) {
            ctx.log("TRACKS", "Track review requested but no probe-able media file found — skipping");
            return;
        }

        TrackFilter resolved;
        try {
            resolved = smartTrackFilterService.resolve(probeTarget, ctx.getRequest().getTrackFilter());
        } catch (Exception e) {
            ctx.logError("TRACKS", "Track probe failed (" + e.getMessage() + ") — skipping review");
            return;
        }
        boolean hasTracks = notEmpty(resolved.getAllAudioTracks()) || notEmpty(resolved.getAllSubTracks());
        if (!hasTracks) {
            ctx.log("TRACKS", "No audio/subtitle tracks detected — skipping review");
            return;
        }

        long timeoutMin = settingsService.getInt(ConfigKeys.INGESTION_TRACK_REVIEW_TIMEOUT_MINUTES);
        if (timeoutMin <= 0) timeoutMin = 30;
        Duration timeout = Duration.ofMinutes(timeoutMin);
        long deadline = System.currentTimeMillis() + timeout.toMillis();

        TrackReviewOptions options = TrackReviewOptions.from(jobId, resolved, deadline);
        TrackFilter fallback = resolved.toBuilder().explicit(true).build();

        // Free the sequential HTTP download slot while we wait for the admin: a review can sit for
        // up to the timeout, and blocking every other download on a human is wrong (Option B). The
        // slot is RECLAIMED below the moment a selection lands, so the ffmpeg/storyboard pass still
        // holds it and never overlaps a fresh download.
        if (ctx.isQueueManaged()) {
            downloadQueue.signalComplete(jobId);
        }

        trackingService.updateStatus(jobId, MirrorStatus.AWAITING_INPUT);
        ctx.setStatus(MirrorStatus.AWAITING_INPUT);
        ctx.log("TRACKS", "Awaiting track selection — " + options.audio().size() + " audio, "
                + options.subtitles().size() + " subtitle track(s); auto-default in " + timeoutMin + " min");

        TrackFilter chosen = trackReviewCoordinator.awaitSelection(jobId, options, fallback, timeout);
        if (chosen == null) {
            // Cancelled while awaiting — cancel path has already flagged the job; let the caller end it.
            return;
        }
        TrackFilter applied = chosen.isExplicit() ? chosen : chosen.toBuilder().explicit(true).build();
        ctx.getRequest().setTrackFilter(applied);
        ctx.log("TRACKS", "Applying selection — keepAudio=" + applied.getKeepAudioLanguages()
                + ", keepSubs=" + applied.getKeepSubtitleLanguages());

        // Reclaim the download slot for the processing phase (Option B): ffmpeg + storyboard now run
        // while holding the slot, so a fresh download never starts alongside this job's processing.
        // The slot is finally released in execute()'s finally — i.e. after ALL processing. Move off
        // AWAITING_INPUT first so the UI drops the track-review banner.
        // A released ("Run now") job runs in parallel — it never held the single download slot, so it
        // neither reclaims nor blocks on it. Every other job reclaims the slot for processing (Option B).
        if (ctx.isQueueManaged() && !ctx.isParallel()) {
            trackingService.updateStatus(jobId, MirrorStatus.PROCESSING);
            ctx.setStatus(MirrorStatus.PROCESSING);
            ctx.log("QUEUE", "Reclaiming download slot for processing…");
            downloadQueue.enqueueForReprocess(jobId);
            if (!downloadQueue.awaitTurn(jobId, () -> isCancelled(ctx))) {
                return; // cancelled while waiting to reclaim — caller ends the job
            }
            ctx.log("QUEUE", "Download slot reclaimed");
        }
    }

    /** The file to probe for track review: the file itself, or the largest media file in a directory. */
    private Path resolveProbeTarget(Path fileOrDir) {
        try {
            if (Files.isRegularFile(fileOrDir)) return fileOrDir;
            if (Files.isDirectory(fileOrDir)) {
                try (var stream = Files.walk(fileOrDir)) {
                    return stream.filter(Files::isRegularFile)
                            .filter(this::isMediaFile)
                            .max(Comparator.comparingLong(this::sizeQuietly))
                            .orElse(null);
                }
            }
        } catch (Exception e) {
            log.warn("resolveProbeTarget failed for {}: {}", fileOrDir, e.getMessage());
        }
        return null;
    }

    private boolean isMediaFile(Path p) {
        String name = p.getFileName().toString();
        int dot = name.lastIndexOf('.');
        return dot > 0 && MEDIA_EXTENSIONS.contains(name.substring(dot + 1).toLowerCase());
    }

    private long sizeQuietly(Path p) {
        try { return Files.size(p); } catch (Exception e) { return 0L; }
    }

    private static boolean notEmpty(List<?> list) {
        return list != null && !list.isEmpty();
    }

    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Tries to acquire the semaphore, polling every 500 ms.
     * Logs a one-time "waiting" message on first failure and checks for
     * cancellation on each poll so the job can be cancelled while queued.
     * Returns false (and calls markCancelled) if the job is cancelled while waiting.
     */
    private boolean tryAcquireSlot(Semaphore semaphore, IngestionContext ctx, String slotName)
            throws InterruptedException {
        if (semaphore.tryAcquire()) return true;
        ctx.log("PROCESS", "Waiting for " + slotName + "…");
        while (!semaphore.tryAcquire(500, TimeUnit.MILLISECONDS)) {
            if (isCancelled(ctx)) {
                markCancelled(ctx);
                return false;
            }
        }
        return true;
    }

    // ──────────────────────────────────────────────────────────────────────────

    private boolean isCancelled(IngestionContext ctx) {
        return ctx.isCancelled() || trackingService.isCancelled(ctx.getJobId());
    }

    private void markCancelled(IngestionContext ctx) {
        ctx.log("PIPELINE", "Job cancelled");
        ctx.setStatus(MirrorStatus.CANCELLED);
        trackingService.updateStatus(ctx.getJobId(), MirrorStatus.CANCELLED);
        ctx.setHtmlReport(trackingService.getHtmlReport(ctx.getJobId()));
        safeRepositorySave(ctx);
    }

    private void safeRepositorySave(IngestionContext ctx) {
        try { repository.save(ctx); } catch (Exception e) {
            log.warn("[{}] Failed to persist final state: {}", ctx.getJobId(), e.getMessage());
        }
    }

    /**
     * Best-effort removal of this job's temp artifacts (downloaded archive/file + extract dir) once the
     * job ends — success, failure, or cancel. The final media already moved to the stream dir is NOT a
     * temp artifact (untouched); local source files are never tracked, so they're never deleted.
     */
    private void cleanupTempArtifacts(IngestionContext ctx) {
        for (Path p : ctx.getTempArtifacts()) {
            if (p == null) continue;
            try {
                if (!Files.exists(p)) continue;
                if (Files.isDirectory(p)) {
                    try (var s = Files.walk(p)) {
                        s.sorted(Comparator.reverseOrder()).forEach(x -> {
                            try { Files.deleteIfExists(x); } catch (Exception ignored) { /* best-effort */ }
                        });
                    }
                } else {
                    Files.deleteIfExists(p);
                }
                ctx.log("CLEANUP", "Removed temp: " + p.getFileName());
            } catch (Exception e) {
                log.warn("[{}] Temp cleanup failed for {}: {}", ctx.getJobId(), p, e.getMessage());
            }
        }
    }

    private PipelineStepType resolveStep(ProcessingStrategy processor) {
        String name = processor.getClass().getSimpleName().toLowerCase();
        if (name.contains("extract")) return PipelineStepType.EXTRACT;
        if (name.contains("ffmpeg") || name.contains("media")) return PipelineStepType.FFMPEG;
        if (name.contains("merge")) return PipelineStepType.MERGE;
        return PipelineStepType.MEDIA_INFO;
    }

    private void updateStep(IngestionContext ctx, PipelineStepType step) {
        ctx.setCurrentStep(step);
        trackingService.updateStep(ctx.getJobId(), step);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Admin push notifications — fired only on the three job state transitions
    // (queued / complete / failed), never on progress ticks. Fully best-effort:
    // a push hiccup must never affect the job.
    // ──────────────────────────────────────────────────────────────────────────

    private void notifyAdmins(String title, String recordName, IngestionRequest request) {
        try {
            pushService.broadcastToAdmins(title, ingestionTargetName(recordName, request),
                    Map.of("route", "admin/ingestion"), "admin");
        } catch (Exception e) {
            log.debug("[push] admin ingestion notify '{}' failed: {}", title, e.toString());
        }
    }

    /** A concise, human display name for the job's target (record name → file → folder → uri). */
    private static String ingestionTargetName(String recordName, IngestionRequest req) {
        if (recordName != null && !recordName.isBlank()) return recordName;
        if (req != null) {
            if (req.getFileName() != null && !req.getFileName().isBlank()) return req.getFileName();
            if (req.getFolderName() != null && !req.getFolderName().isBlank()) return req.getFolderName();
            if (req.getUri() != null && !req.getUri().isBlank()) return req.getUri();
            if (req.getLocalFilePath() != null && !req.getLocalFilePath().isBlank()) return req.getLocalFilePath();
        }
        return "media job";
    }
}
