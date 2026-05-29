package com.db.dbworld.app.media.sync;

import com.db.dbworld.app.admin.scheduler.entity.SchedulerJobHistoryEntity;
import com.db.dbworld.app.admin.scheduler.repository.SchedulerJobConfigRepository;
import com.db.dbworld.app.admin.scheduler.repository.SchedulerJobHistoryRepository;
import com.db.dbworld.app.media.info.dto.MediaFileDto;
import com.db.dbworld.app.media.info.entity.MediaFileEntity;
import com.db.dbworld.app.media.info.repository.MediaFileRepository;
import com.db.dbworld.app.media.info.service.MediaInfoService;
import com.db.dbworld.app.media.link.SymlinkService;
import com.db.dbworld.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.apache.logging.log4j.ThreadContext;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.FileTime;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Filesystem ↔ database reconciliation scanner.
 *
 * <p>Replaces the previous {@code FileWatcherService} (kernel-event-based
 * approach using {@link java.nio.file.WatchService}). The watcher had three
 * structural issues that this service eliminates:
 *
 * <ol>
 *   <li><b>Silent drift on non-local filesystems.</b> inotify does not propagate
 *       events for CIFS / SMB / NFS shares, so files added or removed from a
 *       Windows machine over the network share never reached the watcher.</li>
 *   <li><b>Drift across app restarts.</b> Any filesystem change while the JVM
 *       was down was permanently lost — there was no catch-up logic short of
 *       the admin "cleanup" endpoint.</li>
 *   <li><b>OVERFLOW events.</b> Bulk operations (rsync of 1000 files, torrent
 *       finalisation, etc.) overflow inotify's per-watch queue and the kernel
 *       drops event details. The previous code didn't handle OVERFLOW, so
 *       under load we'd silently miss changes.</li>
 * </ol>
 *
 * <p>This service walks {@code app.stream-path} every {@link MediaSyncProperties#interval},
 * compares the set of regular files against {@code media_files.file_path}, and
 * applies the diff:
 * <ul>
 *   <li>on disk but not in DB → {@link MediaInfoService#collectAndPersist}</li>
 *   <li>in DB but not on disk → {@link MediaInfoService#deleteByFilePath} +
 *       symlink cleanup</li>
 * </ul>
 *
 * <p>Properties:
 * <ul>
 *   <li><b>Single writer</b> — only this service writes media_files for
 *       filesystem-derived events. Admin endpoints that mutate files in-band
 *       (delete + DB row update inside one request) remain correct; the scan
 *       sees no diff on the next tick.</li>
 *   <li><b>Idempotent</b> — running it twice in a row with no FS changes
 *       produces the same DB state.</li>
 *   <li><b>Self-healing</b> — runs once on startup ({@link ApplicationReadyEvent})
 *       so any drift from the previous shutdown is reconciled before the first
 *       user request.</li>
 *   <li><b>FS-agnostic</b> — works identically on ext4, CIFS, NFS, SMB,
 *       FUSE-mounted volumes; anywhere {@link Files#walk} works.</li>
 *   <li><b>No race conditions</b> — because there is one writer, the
 *       admin/watcher race that produced StaleObjectStateException is
 *       architecturally impossible here.</li>
 * </ul>
 */
@Service
@Log4j2
@RequiredArgsConstructor
@EnableConfigurationProperties(MediaSyncProperties.class)
public class MediaSyncService {

    /** Scheduler job id used both in scheduler_job_config and scheduler_job_history. */
    public static final String JOB_ID = "MediaSync";

    private final MediaSyncProperties           props;
    private final MediaInfoService              mediaInfoService;
    private final MediaFileRepository           mediaFileRepository;
    private final SymlinkService                symlinkService;
    private final AppProperties                 appProperties;
    private final SchedulerJobConfigRepository  schedulerConfigRepo;
    private final SchedulerJobHistoryRepository schedulerHistoryRepo;

    /** Wall-clock millis when the most recent scan finished — exposed for diagnostics. */
    private final AtomicLong lastScanCompletedAt = new AtomicLong(0);

    // ── Lifecycle ────────────────────────────────────────────────────────────

    /**
     * Cold-start scan. Runs after the application context is fully refreshed
     * so all repositories are wired. {@link Order} pushes us to the back of
     * the listener queue so the database is definitely ready.
     */
    @EventListener(ApplicationReadyEvent.class)
    @Order(Integer.MAX_VALUE - 100)
    public void scanOnStartup() {
        if (!props.enabled()) {
            log.info("MediaSync disabled (dbworld.media-sync.enabled=false) — skipping cold-start scan");
            return;
        }
        log.info("MediaSync: cold-start reconciliation starting (interval={}, stability-window={})",
                props.interval(), props.stabilityWindow());
        scan();
    }

    /**
     * Periodic reconciliation. {@code fixedDelay} guarantees no overlap with
     * the previous run — if a scan takes 2 minutes on a slow filesystem, the
     * next scan starts {@link MediaSyncProperties#interval()} after the prior
     * one finished, not 2 minutes earlier.
     */
    @Scheduled(fixedDelayString = "${dbworld.media-sync.interval:60s}")
    public void scheduledScan() {
        // application.yml gate first (compile-time off-switch); then live
        // DB-driven gate so the admin scheduler UI's enable/disable toggle
        // takes effect without a restart.
        if (!props.enabled()) return;
        boolean enabledInDb = schedulerConfigRepo.findById(JOB_ID)
                .map(c -> c.isEnabled())
                .orElse(true); // first boot: row may not be seeded yet
        if (!enabledInDb) {
            log.debug("MediaSync: disabled in scheduler_job_config; skipping tick");
            return;
        }
        scan();
    }

    // ── Core scan ────────────────────────────────────────────────────────────

    /**
     * Runs a single reconciliation pass. Public so admin endpoints can
     * trigger an on-demand scan if needed.
     */
    public SyncReport scan() {
        ThreadContext.put("traceId", "media-sync-" + UUID.randomUUID());
        LocalDateTime startedAt = LocalDateTime.now();
        long start = System.currentTimeMillis();
        SyncReport report;

        try {
            Path root = appProperties.getStreamPath();
            if (root == null || !Files.isDirectory(root)) {
                log.warn("MediaSync: stream root not a directory ({}); skipping", root);
                report = new SyncReport(0, 0, 0, System.currentTimeMillis() - start, true);
                persistHistory(startedAt, report, "stream root not a directory: " + root);
                return report;
            }

            var onDisk = walkRoot(root);
            var inDb   = loadDbState();

            var toAdd    = setDifference(onDisk.keySet(), inDb.keySet());
            var toRemove = setDifference(inDb.keySet(),   onDisk.keySet());

            int added   = applyAdditions(toAdd, onDisk);
            int removed = applyRemovals(toRemove, inDb);

            long duration = System.currentTimeMillis() - start;
            report = new SyncReport(added, removed, onDisk.size(), duration, false);

            if (report.changed()) {
                log.info("MediaSync: added={} removed={} total-on-disk={} took={}ms",
                        added, removed, onDisk.size(), duration);
            } else {
                log.debug("MediaSync: no changes (total-on-disk={}, took {}ms)",
                        onDisk.size(), duration);
            }
            persistHistory(startedAt, report,
                    report.changed() ? "added=" + added + ", removed=" + removed : null);
            return report;

        } catch (Exception e) {
            log.error("MediaSync: scan failed: {}", e.getMessage(), e);
            report = new SyncReport(0, 0, 0, System.currentTimeMillis() - start, true);
            persistHistory(startedAt, report, e.getMessage());
            return report;
        } finally {
            lastScanCompletedAt.set(System.currentTimeMillis());
            ThreadContext.clearAll();
        }
    }

    /**
     * Writes a row to scheduler_job_history so the admin UI's per-job history
     * drawer surfaces the scan outcome alongside cron-job runs. Best-effort —
     * a history-write failure must not crash the scan itself.
     */
    private void persistHistory(LocalDateTime startedAt, SyncReport report, String message) {
        try {
            schedulerHistoryRepo.save(SchedulerJobHistoryEntity.builder()
                    .jobName(JOB_ID)
                    .startedAt(startedAt)
                    .durationMs(report.durationMs())
                    .status(report.failed() ? "FAILED" : "SUCCESS")
                    .message(message)
                    .build());
        } catch (Exception e) {
            log.warn("MediaSync: failed to write history row: {}", e.getMessage());
        }
    }

    // ── Walk + filter ────────────────────────────────────────────────────────

    private Map<String, FileSnapshot> walkRoot(Path root) {
        var out = new HashMap<String, FileSnapshot>();
        try (Stream<Path> stream = Files.walk(root)) {
            stream.filter(Files::isRegularFile)
                  .filter(this::isCandidate)
                  .forEach(p -> {
                      try {
                          var attrs = Files.readAttributes(p, BasicFileAttributes.class);
                          out.put(p.toAbsolutePath().toString(),
                                  new FileSnapshot(p, attrs.lastModifiedTime(), attrs.size()));
                      } catch (IOException e) {
                          log.debug("MediaSync: unreadable {} ({}); skipping", p, e.getMessage());
                      }
                  });
        } catch (IOException e) {
            log.error("MediaSync: walk failed for {}: {}", root, e.getMessage(), e);
        }
        return out;
    }

    /**
     * Filters out files that should never be indexed:
     * <ul>
     *   <li>Hidden files ({@code .DS_Store}, {@code .partial}, etc.)</li>
     *   <li>aria2 control files ({@code *.aria2}) — these are sidecars, not media</li>
     *   <li>Common in-progress extensions ({@code *.tmp}, {@code *.part})</li>
     * </ul>
     * Everything else is a candidate; {@link MediaInfoService#collectAndPersist}
     * will reject it cleanly if ffprobe can't read it as media.
     */
    private boolean isCandidate(Path p) {
        String name = p.getFileName().toString().toLowerCase(Locale.ROOT);
        return !(name.startsWith(".")
                || name.endsWith(".aria2")
                || name.endsWith(".tmp")
                || name.endsWith(".part")
                || name.endsWith(".crdownload"));
    }

    // ── DB state ─────────────────────────────────────────────────────────────

    private Map<String, MediaFileEntity> loadDbState() {
        // Duplicate filePath rows (legacy from the pre-b0d0cf3 torrent bug)
        // are reduced to first-seen here. They'll be picked up by the next
        // delete tick if the path is missing on disk, eventually converging.
        return mediaFileRepository.findAll().stream()
                .filter(e -> e.getFilePath() != null)
                .collect(Collectors.toMap(
                        MediaFileEntity::getFilePath,
                        Function.identity(),
                        (a, b) -> a));
    }

    // ── Diff application ─────────────────────────────────────────────────────

    private int applyAdditions(Set<String> paths, Map<String, FileSnapshot> snapshots) {
        if (paths.isEmpty()) return 0;
        int count = 0;
        long stabilityCutoff = System.currentTimeMillis() - props.stabilityWindow().toMillis();

        for (String pathStr : paths) {
            var snap = snapshots.get(pathStr);
            if (snap.mtime().toMillis() > stabilityCutoff) {
                // File is still being written; let it settle and pick it up next tick.
                log.debug("MediaSync: stability gate — deferring {} (mtime within stability window)", pathStr);
                continue;
            }
            try {
                MediaFileDto dto = mediaInfoService.collectAndPersist(snap.path(), null, null);
                // collectAndPersist writes media_files + media_tracks but does
                // NOT create the /symlinks/<id> system link — that's a
                // separate concern owned by SymlinkService. The retired
                // FileWatcherService used to call ensureSystemLink right
                // here; keep parity so files surfaced by the scan are
                // immediately streamable via the symlink URL.
                if (dto != null && dto.getId() != null) {
                    try {
                        symlinkService.ensure(dto.getId(), dto.getFilePath());
                    } catch (Exception linkErr) {
                        log.warn("MediaSync: symlink creation failed for id={} path={}: {}",
                                dto.getId(), pathStr, linkErr.getMessage());
                    }
                }
                log.info("MediaSync: added {} (id={})", pathStr, dto != null ? dto.getId() : "?");
                count++;
            } catch (Exception e) {
                log.warn("MediaSync: failed to add {}: {}", pathStr, e.getMessage(), e);
            }
        }
        return count;
    }

    private int applyRemovals(Set<String> paths, Map<String, MediaFileEntity> dbState) {
        if (paths.isEmpty()) return 0;
        int count = 0;
        for (String pathStr : paths) {
            try {
                var entity = dbState.get(pathStr);
                mediaInfoService.deleteByFilePath(pathStr);
                if (entity != null) {
                    symlinkService.deleteById(entity.getId());
                    log.info("MediaSync: removed {} (id={})", pathStr, entity.getId());
                } else {
                    log.info("MediaSync: removed {}", pathStr);
                }
                count++;
            } catch (Exception e) {
                log.warn("MediaSync: failed to remove {}: {}", pathStr, e.getMessage(), e);
            }
        }
        return count;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static <T> Set<T> setDifference(Set<T> from, Set<T> remove) {
        var out = new HashSet<>(from);
        out.removeAll(remove);
        return out;
    }

    /** Last completed scan timestamp (epoch millis), or 0 if no scan has run yet. */
    public long lastScanCompletedAt() {
        return lastScanCompletedAt.get();
    }

    // ── Records ──────────────────────────────────────────────────────────────

    /**
     * Result of one reconciliation pass. Returned by {@link #scan()} and used
     * in tests / on-demand admin invocations.
     *
     * @param added         files newly persisted to media_files this tick
     * @param removed       media_files rows deleted because the file vanished
     * @param totalOnDisk   total count of candidate files seen on disk
     * @param durationMs    wall-clock time spent in the scan
     * @param failed        true if the scan aborted early due to an unrecoverable error
     */
    public record SyncReport(
            int     added,
            int     removed,
            int     totalOnDisk,
            long    durationMs,
            boolean failed
    ) {
        public boolean changed() { return added > 0 || removed > 0; }
    }

    /** Per-file snapshot captured during the walk. */
    private record FileSnapshot(Path path, FileTime mtime, long size) {}
}
