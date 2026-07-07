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

import com.db.dbworld.app.media.ingestion.tracking.FileSubStep;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

/**
 * In-memory implementation of TrackingService.
 * Terminal jobs have their elapsedMs frozen and are evicted from the map
 * after TERMINAL_TTL_MINUTES to stop broadcasting stale data.
 */
@Log4j2
@Service
public class InMemoryTrackingService implements TrackingService {

    private static final long TERMINAL_TTL_MINUTES = 10;

    private final ConcurrentMap<String, JobState> jobs = new ConcurrentHashMap<>();
    private final HtmlReportBuilder reportBuilder = new HtmlReportBuilder();
    private final MirrorStateMachine stateMachine  = new MirrorStateMachine();

    private final ScheduledExecutorService cleaner = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "job-state-cleaner");
        t.setDaemon(true);
        return t;
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Core state mutations
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public void updateStatus(String jobId, MirrorStatus newStatus) {
        JobState state = getOrCreate(jobId);
        MirrorStatus current = state.status.get();

        if (current == newStatus) return;

        if (stateMachine.canTransition(current, newStatus) || newStatus == MirrorStatus.CANCELLED) {
            state.status.set(newStatus);
            state.logCollector.info(newStatus.name(), "Status → " + newStatus);
            if (isTerminal(newStatus)) {
                markFinished(jobId, state);
            }
            log.info("[{}] Status transition {} → {}", jobId, current, newStatus);
        } else {
            log.warn("[{}] Illegal transition {} → {} ignored", jobId, current, newStatus);
        }
    }

    @Override
    public void updateStep(String jobId, PipelineStepType step) {
        JobState state = getOrCreate(jobId);
        PipelineStepType previous = state.step.get();
        state.step.set(step);
        // Reset the (overloaded) progress snapshot on any transition away from DOWNLOAD, so a
        // stale download snapshot — a huge remaining/speed ETA sitting at ~100% — cannot leak
        // into the EXTRACT/FFMPEG bars. Each processing strategy repopulates it with its own
        // progress; until it does, the bar reads a neutral 0 rather than a bogus 574h/100%.
        if (step != null && step != PipelineStepType.DOWNLOAD) {
            state.progress.set(ProgressSnapshot.processing());
        }
        state.logCollector.info(step.name(), "Step → " + step);
        log.info("[{}] Step transition {} → {}", jobId, previous, step);
    }

    @Override
    public void updateProgress(String jobId, ProgressSnapshot progress) {
        JobState state = getOrCreate(jobId);
        state.progress.set(progress);
        // Route ffmpeg timeline progress to the active file's FFMPEG sub-step. Within a job,
        // files are processed sequentially (only one active at a time), so currentFile is
        // unambiguous. Skipped during EXTRACT (no file active yet) and download (bytes phase).
        if (progress != null && "processing".equals(progress.phase()) && progress.totalBytes() > 0) {
            FileProgressState f = state.currentFile();
            if (f != null && "ffmpeg".equals(f.subStep)) {
                // downloadedBytes/totalBytes carry ffmpeg out_time/duration in ms during processing.
                f.ffmpegPositionMs = progress.downloadedBytes();
                f.ffmpegDurationMs = progress.totalBytes();
                f.ffmpegPercent    = clampPercent(progress.downloadedBytes() * 100.0 / progress.totalBytes());
            }
        }
    }

    @Override
    public void initFiles(String jobId, List<String> fileNames) {
        JobState state = getOrCreate(jobId);
        state.files.clear();
        int i = 1;
        for (String name : fileNames) {
            state.files.put(i, new FileProgressState(i, name));
            i++;
        }
        state.fileTotal = fileNames.size();
        state.currentFileIndex = -1;
    }

    @Override
    public void startFileSubStep(String jobId, int fileIndex, FileSubStep subStep) {
        JobState state = getOrCreate(jobId);
        FileProgressState f = state.files.get(fileIndex);
        if (f == null) return;
        state.currentFileIndex = fileIndex;
        f.status  = "active";
        f.subStep = subStep.name().toLowerCase(Locale.ROOT);
    }

    @Override
    public void updateFilePercent(String jobId, int fileIndex, FileSubStep subStep, double percent) {
        JobState state = getOrCreate(jobId);
        FileProgressState f = state.files.get(fileIndex);
        if (f == null) return;
        double p = clampPercent(percent);
        switch (subStep) {
            case FFMPEG     -> f.ffmpegPercent     = p;
            case MEDIA_INFO -> f.mediaInfoPercent  = p;
            case STORYBOARD -> f.storyboardPercent = p;
        }
    }

    @Override
    public void finishFile(String jobId, int fileIndex, boolean success) {
        JobState state = getOrCreate(jobId);
        FileProgressState f = state.files.get(fileIndex);
        if (f != null) {
            f.status  = success ? "done" : "failed";
            f.subStep = null;
            if (success) {
                // FFmpeg + MediaInfo always complete on success; storyboard is best-effort
                // (legitimately skipped for very short clips), so its percent is left as-is.
                f.ffmpegPercent    = 100.0;
                f.mediaInfoPercent = 100.0;
            }
        }
        if (state.currentFileIndex == fileIndex) {
            state.currentFileIndex = -1;
        }
    }

    @Override
    public void updateJobMeta(String jobId, String sourceType, String fileName, String uri,
                              Long recordId, String recordName) {
        JobState state = getOrCreate(jobId);
        state.sourceType = sourceType;
        state.fileName   = fileName;
        state.uri        = uri;
        state.recordId   = recordId;
        state.recordName = recordName;
    }

    @Override
    public void fail(String jobId, String reason) {
        JobState state = getOrCreate(jobId);
        state.status.set(MirrorStatus.FAILED);
        state.failReason = reason;
        state.logCollector.error("FAIL", reason != null ? reason : "Unknown error");
        markFinished(jobId, state);
        log.error("[{}] FAILED — {}", jobId, reason);
    }

    @Override
    public void complete(String jobId) {
        JobState state = getOrCreate(jobId);
        state.status.set(MirrorStatus.SUCCESS);
        state.logCollector.info("COMPLETE", "Job completed successfully");
        markFinished(jobId, state);
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
    public boolean hasJob(String jobId) {
        return jobs.containsKey(jobId);
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

    @Override
    public void remove(String jobId) {
        jobs.remove(jobId);
        log.debug("[{}] Removed from tracking map", jobId);
    }

    @Override
    public void restoreJob(String jobId, Instant startedAt, MirrorStatus status,
                           String sourceType, String fileName, String uri,
                           Long recordId, String recordName) {
        long startMs = startedAt != null ? startedAt.toEpochMilli() : System.currentTimeMillis();
        JobState state = new JobState(jobId, startMs);
        state.status.set(status != null ? status : MirrorStatus.QUEUED);
        state.sourceType = sourceType;
        state.fileName   = fileName;
        state.uri        = uri;
        state.recordId   = recordId;
        state.recordName = recordName;
        jobs.put(jobId, state);
        log.info("[{}] Restored to tracking map (status={})", jobId, status);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internals
    // ──────────────────────────────────────────────────────────────────────────

    private JobState getOrCreate(String jobId) {
        return jobs.computeIfAbsent(jobId, JobState::new);
    }

    private static boolean isTerminal(MirrorStatus status) {
        return status == MirrorStatus.SUCCESS   || status == MirrorStatus.FAILED
            || status == MirrorStatus.CANCELLED  || status == MirrorStatus.COMPLETED;
    }

    private static double clampPercent(double pct) {
        return Math.max(0.0, Math.min(100.0, pct));
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private void markFinished(String jobId, JobState state) {
        if (state.finishedAt == null) {
            state.finishedAt = System.currentTimeMillis();
            cleaner.schedule(() -> {
                jobs.remove(jobId);
                log.debug("[{}] Evicted from tracking map after {}m TTL", jobId, TERMINAL_TTL_MINUTES);
            }, TERMINAL_TTL_MINUTES, TimeUnit.MINUTES);
        }
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

        // Freeze elapsed at completion time so the frontend timer stops incrementing
        long elapsed = state.finishedAt != null
                ? state.finishedAt - state.startTime
                : System.currentTimeMillis() - state.startTime;
        map.put("elapsedMs", elapsed);

        if (state.failReason != null) map.put("failReason", state.failReason);

        ProgressSnapshot p = state.progress.get();
        if (p != null) {
            Map<String, Object> progressMap = new LinkedHashMap<>();
            progressMap.put("downloaded", p.downloadedBytes());
            progressMap.put("total",      p.totalBytes());
            progressMap.put("speed",      p.speed());
            progressMap.put("eta",        p.eta());
            progressMap.put("phase",      p.phase() != null ? p.phase() : "downloading");
            if (p.totalBytes() > 0) {
                // Clamp to [0,100]: ffmpeg out_time can slightly exceed Duration and yt-dlp's
                // committed-bytes accounting can overshoot total, which otherwise renders >100%.
                double pct = ((double) p.downloadedBytes() / p.totalBytes()) * 100.0;
                pct = Math.max(0.0, Math.min(100.0, pct));
                progressMap.put("percent", Math.round(pct * 10.0) / 10.0);
            }
            map.put("progress", progressMap);
        }

        // Per-file breakdown (season packs / multi-file jobs). Absent for jobs that never
        // registered files (e.g. still downloading), so the UI falls back to the single bar.
        if (state.fileTotal > 0) {
            map.put("fileTotal", state.fileTotal);
            map.put("fileIndex", state.currentFileIndex > 0 ? state.currentFileIndex : null);
            List<Map<String, Object>> files = state.files.values().stream()
                    .sorted(Comparator.comparingInt(f -> f.index))
                    .map(f -> {
                        Map<String, Object> fm = new LinkedHashMap<>();
                        fm.put("index",             f.index);
                        fm.put("name",              f.fileName);
                        fm.put("status",            f.status);
                        fm.put("subStep",           f.subStep);
                        fm.put("ffmpegPercent",     round1(f.ffmpegPercent));
                        fm.put("mediaInfoPercent",  round1(f.mediaInfoPercent));
                        fm.put("storyboardPercent", round1(f.storyboardPercent));
                        fm.put("ffmpegPositionMs",  f.ffmpegPositionMs);
                        fm.put("ffmpegDurationMs",  f.ffmpegDurationMs);
                        return fm;
                    })
                    .collect(Collectors.toList());
            map.put("files", files);

            // Whole-job progress: each file is 1/N of the bar. Done/failed files count as a full
            // unit (so the bar completes even on a failure); the active file contributes its
            // ffmpeg fraction. This is a clean 0-100 that can never render as a bogus time.
            double units = 0;
            for (FileProgressState f : state.files.values()) {
                if ("done".equals(f.status) || "failed".equals(f.status)) units += 1.0;
                else if ("active".equals(f.status)) units += f.ffmpegPercent / 100.0;
            }
            map.put("overallPercent", round1(Math.min(100.0, units / state.fileTotal * 100.0)));
        }
        return map;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Inner state holder
    // ──────────────────────────────────────────────────────────────────────────

    private static class JobState {
        final String  jobId;
        final long    startTime;
        volatile Long finishedAt;

        final AtomicReference<MirrorStatus>     status   = new AtomicReference<>(MirrorStatus.QUEUED);
        final AtomicReference<PipelineStepType> step     = new AtomicReference<>();
        final AtomicReference<ProgressSnapshot> progress = new AtomicReference<>();
        final LogCollector logCollector = new LogCollector();

        volatile String failReason;
        volatile String sourceType;
        volatile String fileName;
        volatile String uri;
        volatile Long   recordId;
        volatile String recordName;

        // Per-file breakdown
        volatile int fileTotal;
        volatile int currentFileIndex = -1;
        final Map<Integer, FileProgressState> files = new ConcurrentHashMap<>();

        FileProgressState currentFile() {
            return currentFileIndex > 0 ? files.get(currentFileIndex) : null;
        }

        JobState(String jobId) {
            this.jobId     = jobId;
            this.startTime = System.currentTimeMillis();
        }

        JobState(String jobId, long startTime) {
            this.jobId     = jobId;
            this.startTime = startTime;
        }
    }

    /** Mutable per-file progress within a job. Fields are volatile — written by the
     *  processing thread, read by the 2s WebSocket broadcast thread. */
    private static class FileProgressState {
        final int index;
        volatile String fileName;
        volatile String status = "pending";   // pending | active | done | failed
        volatile String subStep;               // ffmpeg | media_info | storyboard | null
        volatile double ffmpegPercent;
        volatile double mediaInfoPercent;
        volatile double storyboardPercent;
        volatile long   ffmpegPositionMs;   // encode position (ms) — for the guarded time readout
        volatile long   ffmpegDurationMs;   // clip duration (ms)

        FileProgressState(int index, String fileName) {
            this.index    = index;
            this.fileName = fileName;
        }
    }
}
