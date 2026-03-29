//package com.db.dbworld.services.mirror;
//
//import com.db.dbworld.payloads.MirrorState;
//import com.db.dbworld.payloads.MirrorStatus;
//import jakarta.annotation.PostConstruct;
//import lombok.Getter;
//import lombok.extern.log4j.Log4j2;
//import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.scheduling.annotation.Scheduled;
//import org.springframework.stereotype.Service;
//
//import java.time.Instant;
//import java.util.Comparator;
//import java.util.List;
//import java.util.concurrent.BlockingQueue;
//import java.util.concurrent.LinkedBlockingQueue;
//import java.util.concurrent.atomic.AtomicBoolean;
//
//@Service
//@Log4j2
//public class HttpDownloadQueueService {
//
//    /* =========================================================
//       CONFIG
//       ========================================================= */
//
//    /** Max allowed runtime for a single job before forced release */
//    private static final long MAX_JOB_RUNTIME_MS = 6 * 60 * 60 * 1000L; // 6 hours
//
//    /* =========================================================
//       INTERNAL STATE
//       ========================================================= */
//
//    private final BlockingQueue<String> queue = new LinkedBlockingQueue<>();
//
//    private final AtomicBoolean isRunning = new AtomicBoolean(false);
//
//    @Getter
//    private volatile String currentlyRunningId;
//
//    /* ========================================================= */
//
//    @Autowired
//    private UtilsService utilsService;
//
//    @Autowired
//    private StatusService statusService;
//
//    /* =========================================================
//       PUBLIC API
//       ========================================================= */
//
//    public synchronized void enqueue(MirrorStatus status) {
//
//        if (status == null) return;
//
//        if (status.isMagnet()) {
//            log.debug("Skip queue magnet: {}", status.getFileName());
//            return;
//        }
//
//        if (!isQueueEligible(status)) {
//            log.warn("Not queue eligible: {} state={}",
//                    status.getFileName(),
//                    status.getCurrentState());
//            return;
//        }
//
//        if (queue.contains(status.getId())) {
//            log.debug("Already queued: {}", status.getId());
//            return;
//        }
//
//        queue.offer(status.getId());
//
//        log.info("HTTP queued: {} [{}]",
//                status.getFileName(),
//                status.getId());
//    }
//
//    public List<String> getQueueSnapshot() {
//        return List.copyOf(queue);
//    }
//
//    /* =========================================================
//       SUPERVISOR (SCHEDULER-ONLY CONTROL)
//       ========================================================= */
//
//    @Scheduled(fixedDelay = 3000)
//    public synchronized void queueSupervisor() {
//
//        try {
//
//            // ── CASE 1 — nothing running → start next
//            if (!isRunning.get()) {
//                tryStartNext();
//                return;
//            }
//
//            // ── CASE 2 — validate running job
//            MirrorStatus s = statusService.getStatusById(currentlyRunningId);
//
//            if (s == null) {
//                log.warn("Running job missing → release {}",
//                        currentlyRunningId);
//                releaseRunning();
//                return;
//            }
//
//            // ── CASE 3 — terminal → release
//            if (isTerminal(s)) {
//                log.info("Job terminal → release {} state={}",
//                        currentlyRunningId,
//                        s.getCurrentState());
//                releaseRunning();
//                return;
//            }
//
//            // ── CASE 4 — timeout protection
//            if (isTimedOut(s)) {
//                log.error("Job timeout → force release {}",
//                        currentlyRunningId);
//                releaseRunning();
//            }
//
//        } catch (Exception e) {
//            log.error("Queue supervisor error", e);
//        }
//    }
//
//    /* =========================================================
//       CORE START LOGIC
//       ========================================================= */
//
//    private void tryStartNext() {
//
//        if (!isRunning.compareAndSet(false, true))
//            return;
//
//        String nextId = queue.poll();
//
//        if (nextId == null) {
//            isRunning.set(false);
//            return;
//        }
//
//        MirrorStatus status =
//                statusService.getStatusById(nextId);
//
//        if (status == null || !isQueueEligible(status)) {
//            isRunning.set(false);
//            tryStartNext();
//            return;
//        }
//
//        currentlyRunningId = nextId;
//
//        status.transitionTo(
//                MirrorState.DOWNLOAD,
//                "Started from HTTP queue");
//
//        log.info("Starting HTTP job: {} [{}]",
//                status.getFileName(),
//                nextId);
//
//        try {
//            utilsService.downloadFileUsingAria2c(status);
//        } catch (Exception e) {
//            log.error("Start failed → release {}", nextId, e);
//            releaseRunning();
//        }
//    }
//
//    /* =========================================================
//       RELEASE LOGIC (SAFE)
//       ========================================================= */
//
//    private void releaseRunning() {
//
//        if (!isRunning.compareAndSet(true, false))
//            return;
//
//        String finished = currentlyRunningId;
//        currentlyRunningId = null;
//
//        log.info("Queue released job {}", finished);
//    }
//
//    /* =========================================================
//       STATE RULES
//       ========================================================= */
//
//    private boolean isQueueEligible(MirrorStatus s) {
//        return switch (s.getCurrentState()) {
//            case DOWNLOAD, RESUME -> true;
//            default -> false;
//        };
//    }
//
//    private boolean isTerminal(MirrorStatus s) {
//        if (s == null) return true;
//
//        MirrorState st = s.getCurrentState();
//
//        return st == MirrorState.COMPLETE ||
//                st == MirrorState.FAILED ||
//                st == MirrorState.CANCELLED ||
//                st == MirrorState.PAUSE ||
//                s.isCompleted() ||
//                s.isFailed() ||
//                s.isCancelled() ||
//                s.isPause();
//    }
//
//    private boolean isTimedOut(MirrorStatus s) {
//        try {
//            Instant ts = Instant.parse(s.getTimeStamp());
//            if (ts == null) return false;
//
//            long age =
//                    System.currentTimeMillis()
//                            - ts.toEpochMilli();
//
//            return age > MAX_JOB_RUNTIME_MS;
//
//        } catch (Exception e) {
//            return false;
//        }
//    }
//
//    /* =========================================================
//       CRASH RECOVERY
//       ========================================================= */
//
//    @PostConstruct
//    public void recoverQueueAfterRestart() {
//
//        List<MirrorStatus> pending =
//                statusService.getAllStatus().values().stream()
//                        .filter(s -> !s.isMagnet())
//                        .filter(s -> !isTerminal(s))
//                        .sorted(Comparator.comparing(
//                                MirrorStatus::getTimeStamp))
//                        .toList();
//
//        pending.forEach(s -> queue.offer(s.getId()));
//
//        log.info("Recovered {} HTTP jobs after restart",
//                pending.size());
//
//        isRunning.set(false);
//        currentlyRunningId = null;
//    }
//}
