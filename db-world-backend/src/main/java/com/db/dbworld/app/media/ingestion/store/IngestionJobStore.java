package com.db.dbworld.app.media.ingestion.store;

import com.db.dbworld.app.media.ingestion.model.IngestionRequest;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Central in-memory registry for active ingestion jobs.
 *
 * Stores per-job:
 *  - The original IngestionRequest  → used for rerun
 *  - The Aria2 GID                  → used for pause / resume / cancel via Aria2 RPC
 *  - The source type                → determines which operations are supported
 *  - Cancel / pause / resume actions → registered by each download strategy
 *
 * How GID tracking works:
 *  1. DefaultIngestionPipeline.start() calls register() immediately.
 *  2. Aria2DownloadStrategy calls setGid() after aria2RpcService.addUri() returns the GID.
 *  3. IngestionController reads the GID via getGid() to call aria2RpcService.pause/unpause.
 *  4. yt-dlp jobs have no GID; pause/resume return 400.
 *  5. When a job finishes (success, fail, cancel) remove() is called to free memory.
 */
@Log4j2
@Service
public class IngestionJobStore {

    private final ConcurrentMap<String, JobMeta> store = new ConcurrentHashMap<>();

    // ──────────────────────────────────────────────────────────────────────────
    // Registration
    // ──────────────────────────────────────────────────────────────────────────

    public void register(String jobId, IngestionRequest request) {
        store.put(jobId, new JobMeta(request));
        log.debug("[{}] Job registered in store", jobId);
    }

    public void setSourceType(String jobId, String sourceType) {
        JobMeta meta = store.get(jobId);
        if (meta != null) meta.sourceType.set(sourceType);
    }

    /** Called by Aria2DownloadStrategy after addUri() returns. */
    public void setGid(String jobId, String gid) {
        JobMeta meta = store.get(jobId);
        if (meta != null) {
            meta.gid.set(gid);
            log.debug("[{}] Aria2 GID registered: {}", jobId, gid);
        }
    }

    /** Called by each strategy to wire its cancel action. */
    public void setCancelAction(String jobId, Runnable action) {
        JobMeta meta = store.get(jobId);
        if (meta != null) meta.cancelAction = action;
    }

    /** Called by each strategy to wire its pause action (Aria2 only). */
    public void setPauseAction(String jobId, Runnable action) {
        JobMeta meta = store.get(jobId);
        if (meta != null) meta.pauseAction = action;
    }

    /** Called by each strategy to wire its resume action (Aria2 only). */
    public void setResumeAction(String jobId, Runnable action) {
        JobMeta meta = store.get(jobId);
        if (meta != null) meta.resumeAction = action;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Queries
    // ──────────────────────────────────────────────────────────────────────────

    public Optional<String> getGid(String jobId) {
        JobMeta meta = store.get(jobId);
        if (meta == null) return Optional.empty();
        String gid = meta.gid.get();
        return gid != null ? Optional.of(gid) : Optional.empty();
    }

    public Optional<IngestionRequest> getRequest(String jobId) {
        JobMeta meta = store.get(jobId);
        return meta != null ? Optional.of(meta.request) : Optional.empty();
    }

    public String getSourceType(String jobId) {
        JobMeta meta = store.get(jobId);
        return meta != null ? meta.sourceType.get() : null;
    }

    public boolean hasJob(String jobId) {
        return store.containsKey(jobId);
    }

    public boolean supportsGid(String jobId) {
        return getGid(jobId).isPresent();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Actions
    // ──────────────────────────────────────────────────────────────────────────

    public boolean executeCancelAction(String jobId) {
        JobMeta meta = store.get(jobId);
        if (meta == null || meta.cancelAction == null) return false;
        try {
            meta.cancelAction.run();
            log.info("[{}] Cancel action executed", jobId);
            return true;
        } catch (Exception e) {
            log.warn("[{}] Cancel action failed: {}", jobId, e.getMessage());
            return false;
        }
    }

    public boolean executePauseAction(String jobId) {
        JobMeta meta = store.get(jobId);
        if (meta == null || meta.pauseAction == null) return false;
        try {
            meta.pauseAction.run();
            log.info("[{}] Pause action executed", jobId);
            return true;
        } catch (Exception e) {
            log.warn("[{}] Pause action failed: {}", jobId, e.getMessage());
            return false;
        }
    }

    public boolean executeResumeAction(String jobId) {
        JobMeta meta = store.get(jobId);
        if (meta == null || meta.resumeAction == null) return false;
        try {
            meta.resumeAction.run();
            log.info("[{}] Resume action executed", jobId);
            return true;
        } catch (Exception e) {
            log.warn("[{}] Resume action failed: {}", jobId, e.getMessage());
            return false;
        }
    }

    public void remove(String jobId) {
        store.remove(jobId);
        log.debug("[{}] Removed from job store", jobId);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // WebSocket monitoring support
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Returns a snapshot of all active (jobId → gid) pairs.
     * Used by the WebSocket client to discover which GIDs to poll.
     * Only entries with a non-null GID are included (yt-dlp jobs have no GID).
     */
    public java.util.Map<String, String> getAllActiveGids() {
        java.util.Map<String, String> result = new java.util.HashMap<>();
        store.forEach((jobId, meta) -> {
            String gid = meta.gid.get();
            if (gid != null) result.put(jobId, gid);
        });
        return java.util.Collections.unmodifiableMap(result);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal state holder
    // ──────────────────────────────────────────────────────────────────────────

    private static class JobMeta {
        final IngestionRequest request;
        final AtomicReference<String> gid = new AtomicReference<>();
        final AtomicReference<String> sourceType = new AtomicReference<>();
        volatile Runnable cancelAction;
        volatile Runnable pauseAction;
        volatile Runnable resumeAction;

        JobMeta(IngestionRequest request) {
            this.request = request;
        }
    }
}
