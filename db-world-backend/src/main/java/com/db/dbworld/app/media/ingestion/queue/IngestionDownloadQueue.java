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
import java.util.Set;
import java.util.concurrent.BlockingDeque;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.LinkedBlockingDeque;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BooleanSupplier;

/**
 * Sequential download queue for HTTP/HTTPS downloads via Aria2.
 * Only one HTTP download runs at a time; magnets/torrents bypass the queue.
 * Replaces the old HttpDownloadQueueService.
 *
 * <p>Two extra capabilities sit on top of the plain FIFO:
 * <ul>
 *   <li><b>Reprocess reclaim</b> ({@link #enqueueForReprocess}) — after a job is parked for
 *       interactive track review it releases the slot (so a human wait never blocks other
 *       downloads); once a selection lands it reclaims the slot for its ffmpeg/storyboard pass so
 *       processing is never running alongside a fresh download. Reprocess jobs jump to the FRONT.</li>
 *   <li><b>Release-to-parallel</b> ({@link #releaseNow}) — an admin can pull a still-waiting job out
 *       of the queue to download immediately, in parallel with the current one, bypassing the single
 *       slot (the same way magnets do).</li>
 * </ul>
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

    private final BlockingDeque<QueueEntry> queue = new LinkedBlockingDeque<>();
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final Map<String, QueueEntry> entryMap = new ConcurrentHashMap<>();

    /** Jobs released ("Run now") to run in parallel: they bypass the download slot in awaitTurn AND
     *  the serial processing cap (via {@link #isParallel}). Persist until job end (signalComplete/cancel). */
    private final Set<String> released = ConcurrentHashMap.newKeySet();

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
        // add() over offer(): the deque is unbounded, so insertion cannot fail — and if that
        // ever changes, add() throws rather than silently dropping the job while entryMap
        // and the tracking status below both go on to claim it was queued.
        queue.add(entry);
        entryMap.put(jobId, entry);
        trackingService.updateStatus(jobId, MirrorStatus.QUEUED);

        log.info("[{}] Queued for HTTP download (queue size: {})", jobId, queue.size());
        tryStartNext();
        notifyAll();
        return true;
    }

    /**
     * Re-acquire the slot for a job's POST-track-review processing phase (Option B). Added to the
     * FRONT of the deque so a job that already finished downloading isn't stuck behind fresh
     * downloads, and with no QUEUED status write — the job is moving into processing, not back to
     * the start. Caller then {@link #awaitTurn}s as usual.
     */
    public synchronized boolean enqueueForReprocess(String jobId) {
        if (entryMap.containsKey(jobId)) return true;
        QueueEntry entry = new QueueEntry(jobId, System.currentTimeMillis());
        queue.offerFirst(entry);
        entryMap.put(jobId, entry);
        log.info("[{}] Re-queued (front) to reclaim slot for processing", jobId);
        tryStartNext();
        notifyAll();
        return true;
    }

    /**
     * Release-to-parallel: pull a still-waiting job out of the FIFO and let it download NOW, in
     * parallel with whatever holds the slot. The released job does NOT occupy the single slot (the
     * same bypass magnets use), so the FIFO keeps flowing untouched.
     *
     * @return true if the job was waiting and has been released; false if it wasn't queued
     *         (already downloading in the slot, a magnet/yt-dlp job, or already finished).
     */
    public synchronized boolean releaseNow(String jobId) {
        if (jobId.equals(currentlyRunningJobId)) {
            return false; // already downloading in the slot — nothing to release
        }
        boolean wasQueued = queue.removeIf(e -> e.jobId.equals(jobId));
        entryMap.remove(jobId);
        if (!wasQueued) {
            return false; // not waiting in the queue
        }
        released.add(jobId);
        log.info("[{}] Released → running in parallel (bypasses download slot + processing cap)", jobId);
        notifyAll();
        return true;
    }

    public synchronized boolean awaitTurn(String jobId, BooleanSupplier cancelled) throws InterruptedException {
        while (!jobId.equals(currentlyRunningJobId)) {
            if (released.contains(jobId)) { // persists until job end so processing can bypass the cap too
                log.info("[{}] Running in parallel — bypassing the download slot", jobId);
                return true;
            }
            if (cancelled != null && cancelled.getAsBoolean()) {
                cancel(jobId);
                return false;
            }
            wait(1000L);
            tryStartNext();
        }
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

    /** True if the job was released ("Run now") to run in parallel — the pipeline bypasses the serial
     *  processing cap for it. Set by {@link #releaseNow}; cleared at job end. */
    public boolean isParallel(String jobId) {
        return released.contains(jobId);
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

    public synchronized void signalComplete(String jobId) {
        if (jobId.equals(currentlyRunningJobId)) {
            log.info("[{}] Signalled complete → releasing queue", jobId);
            releaseRunning();
        }
        entryMap.remove(jobId);
        released.remove(jobId);
    }

    public synchronized void cancel(String jobId) {
        queue.removeIf(entry -> entry.jobId.equals(jobId));
        entryMap.remove(jobId);
        released.remove(jobId);
        if (jobId.equals(currentlyRunningJobId)) {
            releaseRunning();
        } else {
            notifyAll();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internals
    // ─────────────────────────────────────────────────────────────────────────

    private synchronized void tryStartNext() {
        if (!running.compareAndSet(false, true)) return;

        QueueEntry next = queue.poll();
        if (next == null) {
            running.set(false);
            return;
        }

        currentlyRunningJobId = next.jobId;
        log.info("[{}] Starting from HTTP queue (remaining: {})", next.jobId, queue.size());
        notifyAll();
        // The actual download is already submitted async by the pipeline; this just tracks slot occupancy
    }

    private synchronized void releaseRunning() {
        if (!running.compareAndSet(true, false)) return;
        String finished = currentlyRunningJobId;
        currentlyRunningJobId = null;
        entryMap.remove(finished);
        log.info("[{}] Queue slot released", finished);
        tryStartNext();
        notifyAll();
    }

    private boolean isTimedOut(QueueEntry entry) {
        return (System.currentTimeMillis() - entry.enqueuedAt) > MAX_JOB_RUNTIME_MS;
    }

    @PostConstruct
    void init() {
        running.set(false);
        currentlyRunningJobId = null;
        released.clear();
        log.info("IngestionDownloadQueue initialised");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Inner record
    // ─────────────────────────────────────────────────────────────────────────

    private record QueueEntry(String jobId, long enqueuedAt) {}
}
