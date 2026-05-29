package com.db.dbworld.app.media.ingestion.recovery;

import com.db.dbworld.app.media.aria2.Aria2RpcService;
import com.db.dbworld.app.media.aria2.model.Aria2StatusParam;
import com.db.dbworld.app.media.ingestion.entity.IngestionJobEntity;
import com.db.dbworld.app.media.ingestion.model.IngestionRequest;
import com.db.dbworld.app.media.ingestion.pipeline.IngestionPipeline;
import com.db.dbworld.app.media.ingestion.repository.IngestionJobRepository;
import com.db.dbworld.app.media.ingestion.store.IngestionJobStore;
import com.db.dbworld.app.media.ingestion.tracking.MirrorStatus;
import com.db.dbworld.app.media.ingestion.tracking.ProgressSnapshot;
import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import com.db.dbworld.infrastructure.logging.backoff.FailureBackoff;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.apache.logging.log4j.ThreadContext;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Reconciles non-terminal DB jobs with Aria2's live state on server restart,
 * and periodically surfaces downloads started in Aria2 outside of this UI.
 */
@Log4j2
@Component
@RequiredArgsConstructor
public class IngestionRecoveryService {

    private static final Set<MirrorStatus> TERMINAL_STATUSES =
            Set.of(MirrorStatus.SUCCESS, MirrorStatus.FAILED,
                   MirrorStatus.CANCELLED, MirrorStatus.COMPLETED);

    private final IngestionJobRepository jobRepository;
    private final Aria2RpcService        aria2RpcService;
    private final IngestionPipeline      pipeline;
    private final TrackingService        trackingService;
    private final IngestionJobStore      jobStore;

    /**
     * When aria2 isn't reachable (typical dev box without aria2c running), the
     * 15-second {@link #surfaceExternalDownloads} tick would otherwise log a
     * full ConnectException stack every 15s forever. Backoff: 3 WARNs, then
     * every 40th, and after 10 consecutive failures pause the poll for 5
     * minutes — so a missing aria2 produces ~3 warns and then silence.
     */
    private final FailureBackoff aria2ReachableBackoff =
            new FailureBackoff(3, 40, 10, Duration.ofMinutes(5));

    // ──────────────────────────────────────────────────────────────────────────
    // Startup recovery
    // ──────────────────────────────────────────────────────────────────────────

    @EventListener(ApplicationReadyEvent.class)
    public void recoverOnStartup() {
        ThreadContext.put("traceId", "recovery-" + UUID.randomUUID());
        try {
            log.debug("recoverOnStartup invoked");
            List<IngestionJobEntity> nonTerminal = jobRepository.findByStatusNotIn(TERMINAL_STATUSES);
            if (nonTerminal.isEmpty()) {
                log.info("Recovery: no non-terminal jobs found at startup");
                return;
            }

            log.info("Recovery: {} non-terminal job(s) found — reconciling with Aria2", nonTerminal.size());
            nonTerminal.forEach(this::recoverJob);
            log.info("Recovery: completed reconciliation of {} job(s)", nonTerminal.size());
        } catch (Exception e) {
            log.error("Recovery: startup reconciliation failed", e);
        } finally {
            ThreadContext.clearAll();
        }
    }

    private void recoverJob(IngestionJobEntity job) {
        try {
            log.debug("recoverJob jobId={} gid={} status={}",
                    job.getJobId(), job.getGid(), job.getStatus());
            if (job.getGid() != null) {
                recoverAria2Job(job);
            } else {
                log.warn("[{}] Non-Aria2 job cannot be auto-recovered (no GID) — marking FAILED", job.getJobId());
                markFailed(job, "Server restarted; non-Aria2 job cannot be automatically recovered");
            }
        } catch (Exception e) {
            log.error("[{}] Recovery failed", job.getJobId(), e);
            markFailed(job, "Recovery error: " + e.getMessage());
        }
    }

    private void recoverAria2Job(IngestionJobEntity job) {
        Aria2StatusParam status;
        try {
            status = aria2RpcService.tellStatus(job.getGid());
        } catch (Exception e) {
            log.error("[{}] Cannot reach Aria2 for GID {} during recovery", job.getJobId(), job.getGid(), e);
            markFailed(job, "Server restarted; Aria2 unreachable: " + e.getMessage());
            return;
        }

        String aria2Status = status.getStatus();
        log.debug("[{}] Aria2 reports GID {} status={}", job.getJobId(), job.getGid(), aria2Status);

        if ("active".equals(aria2Status) || "waiting".equals(aria2Status) || "paused".equals(aria2Status)) {
            // Aria2 still has the download — start a new job (Aria2 will resume via partial file)
            IngestionRequest req = reconstructRequest(job);
            String newJobId = pipeline.start(req);
            markFailed(job, "Server restarted; recovery job: " + newJobId);
            log.info("[{}] GID {} still {} → spawned recovery job {}",
                    job.getJobId(), job.getGid(), aria2Status, newJobId);

        } else if ("complete".equals(aria2Status)) {
            // Download finished while server was down — skip download, run processing only
            IngestionRequest req = reconstructRequest(job);
            String filePath = resolveFilePath(status);
            if (filePath != null) {
                req.setLocalFilePath(filePath);
            } else {
                log.warn("[{}] Aria2 reports complete but no file path resolvable from status", job.getJobId());
            }
            String newJobId = pipeline.start(req);
            markFailed(job, "Server restarted; processing-only recovery job: " + newJobId);
            log.info("[{}] GID {} was complete → spawned processing-only job {} (path={})",
                    job.getJobId(), job.getGid(), newJobId, filePath);

        } else {
            // error / removed
            log.warn("[{}] Aria2 GID {} in terminal state {} — marking original job FAILED",
                    job.getJobId(), job.getGid(), aria2Status);
            markFailed(job, "Server restarted; Aria2 reported status: " + aria2Status);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External download surfacing
    // ──────────────────────────────────────────────────────────────────────────

    @Scheduled(fixedDelay = 15_000)
    public void surfaceExternalDownloads() {
        // Skip the RPC entirely while in cooldown — protects against logging
        // the same ConnectException every 15 seconds when aria2 isn't running.
        if (!aria2ReachableBackoff.shouldAttempt()) {
            return;
        }
        try {
            List<Aria2StatusParam> active = aria2RpcService.getActiveDownloads();
            // First success after a streak of failures → one-shot recovery INFO
            // so operators see aria2 came back without grepping for absence.
            if (aria2ReachableBackoff.consecutiveFailures() > 0) {
                log.info("Aria2 reachable again after {} failed attempts",
                        aria2ReachableBackoff.consecutiveFailures());
            }
            aria2ReachableBackoff.recordSuccess();

            Set<String> knownGids = new HashSet<>(jobStore.getAllActiveGids().values());

            for (Aria2StatusParam download : active) {
                String gid = download.getGid();
                if (gid == null || knownGids.contains(gid)) continue;

                // External download not managed by this application
                String syntheticId = "ext-" + gid;
                if (!trackingService.hasJob(syntheticId)) {
                    trackingService.restoreJob(syntheticId, null, MirrorStatus.DOWNLOADING,
                            "EXTERNAL", null, null, null, null);
                    log.info("Surfaced external Aria2 download GID {} as synthetic job {}", gid, syntheticId);
                }

                Long total     = download.getTotalLength();
                Long completed = download.getCompletedLength();
                Long speed     = download.getDownloadSpeed();
                if (total != null && total > 0 && completed != null) {
                    long eta = (speed != null && speed > 0) ? (total - completed) / speed : 0;
                    trackingService.updateProgress(syntheticId,
                            ProgressSnapshot.downloading(completed, total,
                                    speed != null ? speed.doubleValue() : 0.0, eta));
                }
            }
        } catch (Exception e) {
            int streak = aria2ReachableBackoff.recordFailure();
            if (aria2ReachableBackoff.shouldLogWarn()) {
                // Compact message — no stack — once we know aria2 isn't there,
                // the stack adds nothing and dominates the log volume.
                log.warn("Aria2 unreachable (consecutive={}): {}", streak, e.getMessage());
            } else {
                log.debug("Aria2 still unreachable (consecutive={}): {}", streak, e.getMessage());
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────────────

    private IngestionRequest reconstructRequest(IngestionJobEntity job) {
        IngestionRequest req = new IngestionRequest();
        req.setUri(job.getUri());
        req.setRecordId(job.getRecordId());
        req.setSeason(job.getSeasonNumber());
        req.setEpisode(job.getEpisodeNumber());
        req.setFolderName(job.getFolderName());
        return req;
    }

    private String resolveFilePath(Aria2StatusParam status) {
        if (status.getFiles() == null || status.getFiles().isEmpty()) return null;
        String path = status.getFiles().getFirst().getPath();
        return (path != null && !path.isBlank()) ? path : null;
    }

    private void markFailed(IngestionJobEntity job, String reason) {
        job.setStatus(MirrorStatus.FAILED);
        job.setFailReason(reason);
        job.setCompletedAt(Instant.now());
        try {
            jobRepository.save(job);
            log.info("[{}] Recovery marked FAILED — {}", job.getJobId(), reason);
        } catch (Exception e) {
            log.error("[{}] Failed to persist FAILED status during recovery", job.getJobId(), e);
        }
    }
}
