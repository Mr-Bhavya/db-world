package com.db.dbworld.app.media.ingestion.queue;

import com.db.dbworld.app.media.ingestion.tracking.MirrorStatus;
import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Sequential download queue for HTTP/HTTPS downloads via Aria2.
 * Only one HTTP download runs at a time; magnets/torrents bypass the queue.
 * Replaces the old HttpDownloadQueueService.
 *
 * Usage: inject this service into Aria2DownloadStrategy if sequential queuing is needed.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class IngestionDownloadQueue {

    /** Max allowed runtime for a single job before forced release */
    private static final long MAX_JOB_RUNTIME_MS = 6 * 60 * 60 * 1000L; // 6 hours

    private final TrackingService trackingService;

    private final BlockingQueue<QueueEntry> queue = new LinkedBlockingQueue<>();
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final Map<String, QueueEntry> entryMap = new ConcurrentHashMap<>();

    @Getter
    private volatile String currentlyRunningJobId;

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Enqueue a job. Magnets are bypassed — they're handled directly by Aria2 without queuing.
     */
    public synchronized boolean enqueue(String jobId, boolean isMagnet) {
        if (isMagnet) {
            log.debug("[{}] Magnet — bypassing HTTP queue", jobId);
            return false; // signals caller to start immediately
        }

        if (entryMap.containsKey(jobId)) {
            log.debug("[{}] Already queued", jobId);
            return true;
        }

        QueueEntry entry = new QueueEntry(jobId, System.currentTimeMillis());
        queue.offer(entry);
        entryMap.put(jobId, entry);
        trackingService.updateStatus(jobId, MirrorStatus.QUEUED);

        log.info("[{}] Queued for HTTP download (queue size: {})", jobId, queue.size());
        return true;
    }

    public List<String> getQueueSnapshot() {
        return queue.stream().map(e -> e.jobId).toList();
    }

    public int getQueueSize() {
        return queue.size();
    }

    public int getPositionInQueue(String jobId) {
        List<String> snapshot = getQueueSnapshot();
        int idx = snapshot.indexOf(jobId);
        return idx >= 0 ? idx + 1 : -1;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Supervisor
    // ─────────────────────────────────────────────────────────────────────────

    @Scheduled(fixedDelay = 3000)
    public synchronized void queueSupervisor() {
        try {
            if (!running.get()) {
                tryStartNext();
                return;
            }

            // Validate running job is still active
            if (currentlyRunningJobId != null) {
                if (trackingService.isCancelled(currentlyRunningJobId)) {
                    log.info("[{}] Running job cancelled → releasing queue", currentlyRunningJobId);
                    releaseRunning();
                    return;
                }

                QueueEntry entry = entryMap.get(currentlyRunningJobId);
                if (entry != null && isTimedOut(entry)) {
                    log.error("[{}] Job timed out → force releasing", currentlyRunningJobId);
                    releaseRunning();
                }
            }

        } catch (Exception e) {
            log.error("Queue supervisor error", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Called by the download strategy to signal completion
    // ─────────────────────────────────────────────────────────────────────────

    public void signalComplete(String jobId) {
        if (jobId.equals(currentlyRunningJobId)) {
            log.info("[{}] Signalled complete → releasing queue", jobId);
            releaseRunning();
        }
        entryMap.remove(jobId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internals
    // ─────────────────────────────────────────────────────────────────────────

    private void tryStartNext() {
        if (!running.compareAndSet(false, true)) return;

        QueueEntry next = queue.poll();
        if (next == null) {
            running.set(false);
            return;
        }

        currentlyRunningJobId = next.jobId;
        log.info("[{}] Starting from HTTP queue (remaining: {})", next.jobId, queue.size());
        // The actual download is already submitted async by the pipeline; this just tracks slot occupancy
    }

    private void releaseRunning() {
        if (!running.compareAndSet(true, false)) return;
        String finished = currentlyRunningJobId;
        currentlyRunningJobId = null;
        entryMap.remove(finished);
        log.info("[{}] Queue slot released", finished);
    }

    private boolean isTimedOut(QueueEntry entry) {
        return (System.currentTimeMillis() - entry.enqueuedAt) > MAX_JOB_RUNTIME_MS;
    }

    @PostConstruct
    void init() {
        running.set(false);
        currentlyRunningJobId = null;
        log.info("IngestionDownloadQueue initialised");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Inner record
    // ─────────────────────────────────────────────────────────────────────────

    private record QueueEntry(String jobId, long enqueuedAt) {}
}
