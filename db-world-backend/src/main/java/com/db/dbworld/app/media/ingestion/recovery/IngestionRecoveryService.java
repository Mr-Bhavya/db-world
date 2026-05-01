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
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

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

    // ──────────────────────────────────────────────────────────────────────────
    // Startup recovery
    // ──────────────────────────────────────────────────────────────────────────

    @EventListener(ApplicationReadyEvent.class)
    public void recoverOnStartup() {
        List<IngestionJobEntity> nonTerminal = jobRepository.findByStatusNotIn(TERMINAL_STATUSES);
        if (nonTerminal.isEmpty()) return;

        log.info("Recovery: {} non-terminal job(s) found — reconciling with Aria2", nonTerminal.size());
        nonTerminal.forEach(this::recoverJob);
    }

    private void recoverJob(IngestionJobEntity job) {
        try {
            if (job.getGid() != null) {
                recoverAria2Job(job);
            } else {
                markFailed(job, "Server restarted; non-Aria2 job cannot be automatically recovered");
            }
        } catch (Exception e) {
            log.warn("[{}] Recovery failed: {}", job.getJobId(), e.getMessage());
            markFailed(job, "Recovery error: " + e.getMessage());
        }
    }

    private void recoverAria2Job(IngestionJobEntity job) {
        Aria2StatusParam status;
        try {
            status = aria2RpcService.tellStatus(job.getGid());
        } catch (Exception e) {
            log.warn("[{}] Cannot reach Aria2 for GID {}: {}", job.getJobId(), job.getGid(), e.getMessage());
            markFailed(job, "Server restarted; Aria2 unreachable: " + e.getMessage());
            return;
        }

        String aria2Status = status.getStatus();

        if ("active".equals(aria2Status) || "waiting".equals(aria2Status) || "paused".equals(aria2Status)) {
            // Aria2 still has the download — start a new job (Aria2 will resume via partial file)
            IngestionRequest req = reconstructRequest(job);
            String newJobId = pipeline.start(req);
            markFailed(job, "Server restarted; recovery job: " + newJobId);
            log.info("[{}] GID {} still active → recovery job {}", job.getJobId(), job.getGid(), newJobId);

        } else if ("complete".equals(aria2Status)) {
            // Download finished while server was down — skip download, run processing only
            IngestionRequest req = reconstructRequest(job);
            String filePath = resolveFilePath(status);
            if (filePath != null) {
                req.setLocalFilePath(filePath);
            }
            String newJobId = pipeline.start(req);
            markFailed(job, "Server restarted; processing-only recovery job: " + newJobId);
            log.info("[{}] GID {} was complete → processing job {}", job.getJobId(), job.getGid(), newJobId);

        } else {
            // error / removed
            markFailed(job, "Server restarted; Aria2 reported status: " + aria2Status);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External download surfacing
    // ──────────────────────────────────────────────────────────────────────────

    @Scheduled(fixedDelay = 15_000)
    public void surfaceExternalDownloads() {
        try {
            List<Aria2StatusParam> active = aria2RpcService.getActiveDownloads();
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
                            new ProgressSnapshot(completed, total,
                                    speed != null ? speed.doubleValue() : 0.0, eta));
                }
            }
        } catch (Exception e) {
            log.debug("External download surface check failed: {}", e.getMessage());
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
        } catch (Exception e) {
            log.warn("[{}] Failed to persist FAILED status during recovery: {}", job.getJobId(), e.getMessage());
        }
    }
}
