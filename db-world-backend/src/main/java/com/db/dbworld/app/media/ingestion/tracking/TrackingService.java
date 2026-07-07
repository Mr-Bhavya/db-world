package com.db.dbworld.app.media.ingestion.tracking;

import com.db.dbworld.app.media.ingestion.pipeline.PipelineStepType;
import com.db.dbworld.app.media.ingestion.tracking.log.LogCollector;

import java.time.Instant;
import java.util.Map;

public interface TrackingService {

    void updateStatus(String jobId, MirrorStatus status);

    void updateStep(String jobId, PipelineStepType step);

    void updateProgress(String jobId, ProgressSnapshot progress);

    // ── Per-file breakdown (season packs process multiple files sequentially) ──

    /** Register the ordered set of files this job will process; marks each pending and sets N-of-M. */
    void initFiles(String jobId, java.util.List<String> fileNames);

    /** Mark the file at {@code fileIndex} (1-based) active and note which sub-step is starting. */
    void startFileSubStep(String jobId, int fileIndex, FileSubStep subStep);

    /** Set the percent (0-100) of {@code subStep} for the file at {@code fileIndex}. */
    void updateFilePercent(String jobId, int fileIndex, FileSubStep subStep, double percent);

    /** Mark the file at {@code fileIndex} done (or failed) and clear it as the active file. */
    void finishFile(String jobId, int fileIndex, boolean success);

    /** Store display metadata broadcast via WebSocket (sourceType, fileName, uri, recordId, recordName). */
    void updateJobMeta(String jobId, String sourceType, String fileName, String uri,
                       Long recordId, String recordName);

    void fail(String jobId, String reason);

    void complete(String jobId);

    boolean isCancelled(String jobId);

    Map<String, Object> getAll();

    String getHtmlReport(String jobId);

    /**
     * Returns the LogCollector for a job so the pipeline context can share the same
     * instance as the tracking service — ensuring logs written via ctx.log() appear
     * in the HTML report.
     */
    LogCollector getLogCollector(String jobId);

    /** Remove a job from the tracking map (e.g. after terminal state TTL). */
    void remove(String jobId);

    /** True if a job is currently tracked (active or recently terminal). */
    boolean hasJob(String jobId);

    /** Restore a job into the tracking map (used on server restart recovery). */
    void restoreJob(String jobId, Instant startedAt, MirrorStatus status,
                    String sourceType, String fileName, String uri,
                    Long recordId, String recordName);
}
