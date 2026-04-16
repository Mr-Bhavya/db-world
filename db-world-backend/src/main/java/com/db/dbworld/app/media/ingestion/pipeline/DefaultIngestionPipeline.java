package com.db.dbworld.app.media.ingestion.pipeline;

import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.media.ingestion.model.*;
import com.db.dbworld.app.media.ingestion.persistence.IngestionRepository;
import com.db.dbworld.app.media.ingestion.queue.IngestionDownloadQueue;
import com.db.dbworld.app.media.ingestion.spi.*;
import com.db.dbworld.app.media.ingestion.store.IngestionJobStore;
import com.db.dbworld.app.media.ingestion.tracking.*;
import com.db.dbworld.app.media.ingestion.tracking.log.LogCollector;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;

@Log4j2
@RequiredArgsConstructor
public class DefaultIngestionPipeline implements IngestionPipeline {

    private final List<SourceHandler>    sourceHandlers;
    private final List<DownloadStrategy> downloadStrategies;
    private final List<ProcessingStrategy> processors;

    private final TrackingService    trackingService;
    private final IngestionRepository repository;
    private final ExecutorService    jobExecutor;
    private final IngestionJobStore  jobStore;
    private final IngestionDownloadQueue downloadQueue;
    private final RecordRepository   recordRepository;

    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public String start(IngestionRequest request) {
        String jobId = UUID.randomUUID().toString();

        IngestionContext ctx = new IngestionContext();
        ctx.setJobId(jobId);
        ctx.setRequest(request);
        ctx.setStatus(MirrorStatus.QUEUED);
        ctx.setLogCollector(new LogCollector());
        ctx.setRecordId(request.getRecordId());

        jobStore.register(jobId, request);
        trackingService.updateStatus(jobId, MirrorStatus.QUEUED);
        // Share the TrackingService's LogCollector so ctx.log() entries appear in the HTML report
        ctx.setLogCollector(trackingService.getLogCollector(jobId));

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
        // Resolve record name once — carried through all updateJobMeta calls
        final String recordName = resolveRecordName(ctx.getRequest().getRecordId());
        try {
            trackingService.updateStatus(jobId, MirrorStatus.STARTED);
            ctx.setStatus(MirrorStatus.STARTED);
            ctx.log("PIPELINE", "Job started: " + jobId);

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

            // seed uri into tracking so WS shows it immediately
            trackingService.updateJobMeta(jobId, ctx.getSource().getType(),
                    null, ctx.getRequest().getUri(), ctx.getRequest().getRecordId(), recordName);

            // ── Cancellation check ───────────────────────────────────────────
            if (isCancelled(ctx)) { markCancelled(ctx); return; }

            // ── Download ─────────────────────────────────────────────────────
            DownloadStrategy downloader = downloadStrategies.stream()
                    .filter(d -> d.supports(ctx.getSource()))
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException(
                            "No download strategy for source: " + ctx.getSource().getType()));

            DownloadResult downloadResult = downloader.download(ctx);
            ctx.setDownload(downloadResult);

            if (!downloadResult.isSuccess()) {
                if (isCancelled(ctx) || "Cancelled".equalsIgnoreCase(downloadResult.getErrorMessage())) {
                    markCancelled(ctx);
                    return;
                }
                throw new RuntimeException("Download failed: " + downloadResult.getErrorMessage());
            }

            // update fileName in tracking once we know it
            trackingService.updateJobMeta(jobId, ctx.getSource().getType(),
                    downloadResult.getFileName(), ctx.getRequest().getUri(),
                    ctx.getRequest().getRecordId(), recordName);

            ctx.log("DOWNLOAD", "Completed: " + downloadResult.getFileName());

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
        } finally {
            if (ctx.isQueueManaged()) {
                downloadQueue.signalComplete(jobId);
            }
            jobStore.remove(jobId);
        }
    }

    private void runProcessing(IngestionContext ctx, String recordName) throws Exception {
        String jobId = ctx.getJobId();

        trackingService.updateStatus(jobId, MirrorStatus.PROCESSING);
        ctx.setStatus(MirrorStatus.PROCESSING);

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
                String finalFileName = result.getFinalFile().getFileName().toString();
                trackingService.updateJobMeta(jobId, ctx.getSource() != null ? ctx.getSource().getType() : null,
                        finalFileName, ctx.getRequest() != null ? ctx.getRequest().getUri() : null, ctx.getRecordId(), recordName);
                if (ctx.getDownload() != null) {
                    ctx.getDownload().setFilePath(result.getFinalFile());
                    ctx.getDownload().setFileName(finalFileName);
                }
            }

            if (isCancelled(ctx)) { markCancelled(ctx); return; }
        }

        ctx.setStatus(MirrorStatus.SUCCESS);
        ctx.log("PIPELINE", "Job completed successfully");
        trackingService.complete(jobId);
        ctx.setHtmlReport(trackingService.getHtmlReport(jobId));
        repository.save(ctx);
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
}
