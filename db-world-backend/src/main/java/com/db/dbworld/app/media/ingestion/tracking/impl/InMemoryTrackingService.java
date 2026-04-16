package com.db.dbworld.app.media.ingestion.tracking.impl;

import com.db.dbworld.app.media.ingestion.pipeline.PipelineStepType;
import com.db.dbworld.app.media.ingestion.tracking.MirrorStatus;
import com.db.dbworld.app.media.ingestion.tracking.MirrorStateMachine;
import com.db.dbworld.app.media.ingestion.tracking.ProgressSnapshot;
import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import com.db.dbworld.app.media.ingestion.tracking.log.HtmlReportBuilder;
import com.db.dbworld.app.media.ingestion.tracking.log.LogCollector;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicReference;

/**
 * In-memory implementation of TrackingService.
 * Replaces the old StatusServiceImpl for the new ingestion pipeline.
 */
@Log4j2
@Service
public class InMemoryTrackingService implements TrackingService {

    private final ConcurrentMap<String, JobState> jobs = new ConcurrentHashMap<>();
    private final HtmlReportBuilder reportBuilder = new HtmlReportBuilder();
    private final MirrorStateMachine stateMachine = new MirrorStateMachine();

    // ──────────────────────────────────────────────────────────────────────────
    // Core state mutations
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public void updateStatus(String jobId, MirrorStatus newStatus) {
        JobState state = getOrCreate(jobId);
        MirrorStatus current = state.status.get();

        if (current == newStatus) {
            return;
        }

        if (stateMachine.canTransition(current, newStatus) || newStatus == MirrorStatus.CANCELLED) {
            state.status.set(newStatus);
            state.logCollector.info(newStatus.name(), "Status → " + newStatus);
            log.debug("[{}] Status: {} → {}", jobId, current, newStatus);
        } else {
            log.warn("[{}] Illegal transition {} → {} ignored", jobId, current, newStatus);
        }
    }

    @Override
    public void updateStep(String jobId, PipelineStepType step) {
        JobState state = getOrCreate(jobId);
        state.step.set(step);
        state.logCollector.info(step.name(), "Step → " + step);
        log.debug("[{}] Step → {}", jobId, step);
    }

    @Override
    public void updateProgress(String jobId, ProgressSnapshot progress) {
        getOrCreate(jobId).progress.set(progress);
    }

    @Override
    public void updateJobMeta(String jobId, String sourceType, String fileName, String uri,
                              Long recordId, String recordName) {
        JobState state = getOrCreate(jobId);
        state.sourceType  = sourceType;
        state.fileName    = fileName;
        state.uri         = uri;
        state.recordId    = recordId;
        state.recordName  = recordName;
    }

    @Override
    public void fail(String jobId, String reason) {
        JobState state = getOrCreate(jobId);
        state.status.set(MirrorStatus.FAILED);
        state.failReason = reason;
        state.logCollector.error("FAIL", reason != null ? reason : "Unknown error");
        log.error("[{}] FAILED — {}", jobId, reason);
    }

    @Override
    public void complete(String jobId) {
        JobState state = getOrCreate(jobId);
        state.status.set(MirrorStatus.SUCCESS);
        state.logCollector.info("COMPLETE", "Job completed successfully");
        log.info("[{}] COMPLETED", jobId);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Query methods
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public boolean isCancelled(String jobId) {
        JobState state = jobs.get(jobId);
        return state != null && state.status.get() == MirrorStatus.CANCELLED;
    }

    @Override
    public Map<String, Object> getAll() {
        Map<String, Object> result = new LinkedHashMap<>();
        jobs.forEach((jobId, state) -> result.put(jobId, toSummary(jobId, state)));
        return result;
    }

    @Override
    public String getHtmlReport(String jobId) {
        JobState state = jobs.get(jobId);
        if (state == null) {
            return "<html><body><p>Job not found: " + jobId + "</p></body></html>";
        }
        return reportBuilder.build(state.logCollector);
    }

    @Override
    public LogCollector getLogCollector(String jobId) {
        return getOrCreate(jobId).logCollector;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internals
    // ──────────────────────────────────────────────────────────────────────────

    private JobState getOrCreate(String jobId) {
        return jobs.computeIfAbsent(jobId, JobState::new);
    }

    private Map<String, Object> toSummary(String jobId, JobState state) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("jobId",      jobId);
        map.put("status",     state.status.get());
        map.put("step",       state.step.get() != null ? state.step.get().name() : null);
        map.put("sourceType", state.sourceType);
        map.put("fileName",   state.fileName);
        map.put("uri",        state.uri);
        map.put("recordId",   state.recordId);
        if (state.recordName != null) map.put("recordName", state.recordName);
        map.put("startTime",  state.startTime);
        map.put("elapsedMs",  System.currentTimeMillis() - state.startTime);
        if (state.failReason != null) map.put("failReason", state.failReason);

        ProgressSnapshot p = state.progress.get();
        if (p != null) {
            Map<String, Object> progressMap = new LinkedHashMap<>();
            progressMap.put("downloaded", p.downloadedBytes());
            progressMap.put("total",      p.totalBytes());
            progressMap.put("speed",      p.speed());
            progressMap.put("eta",        p.eta());
            if (p.totalBytes() > 0) {
                progressMap.put("percent",
                        Math.round(((double) p.downloadedBytes() / p.totalBytes()) * 100 * 10.0) / 10.0);
            }
            map.put("progress", progressMap);
        }
        return map;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Inner state holder
    // ──────────────────────────────────────────────────────────────────────────

    private static class JobState {
        final String jobId;
        final AtomicReference<MirrorStatus>    status   = new AtomicReference<>(MirrorStatus.QUEUED);
        final AtomicReference<PipelineStepType> step    = new AtomicReference<>();
        final AtomicReference<ProgressSnapshot> progress = new AtomicReference<>();
        final LogCollector logCollector = new LogCollector();
        final long startTime = System.currentTimeMillis();
        volatile String failReason;
        // Meta set by pipeline after source resolution / download
        volatile String sourceType;
        volatile String fileName;
        volatile String uri;
        volatile Long   recordId;
        volatile String recordName;

        JobState(String jobId) {
            this.jobId = jobId;
        }
    }
}
