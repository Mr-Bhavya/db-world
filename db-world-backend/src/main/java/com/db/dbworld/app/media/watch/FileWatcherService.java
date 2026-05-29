package com.db.dbworld.app.media.watch;

import com.db.dbworld.app.cinema.catalog.service.CatalogService;
import com.db.dbworld.app.media.info.dto.MediaFileDto;
import com.db.dbworld.app.media.info.entity.MediaFileEntity;
import com.db.dbworld.app.media.info.repository.MediaFileRepository;
import com.db.dbworld.app.media.info.service.MediaInfoService;
import com.db.dbworld.app.media.link.SymlinkService;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.config.AppProperties;
import com.db.dbworld.utils.FileIdentityUtils;
import com.db.dbworld.utils.RecordPathResolver;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.log4j.Log4j2;
import org.apache.logging.log4j.ThreadContext;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageHeaders;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

import static java.nio.file.StandardWatchEventKinds.*;

/**
 * Watches the stream directory tree for file-system events and keeps the
 * {@code media_files} database table in sync.
 *
 * Replaces {@code services.explorer.StreamFilesWatcherService}.
 *
 * Key improvements over the old implementation:
 * <ul>
 *   <li><b>Simplified new-file processing</b> â€” delegates to
 *       {@link MediaInfoService#collectAndPersist} (single call vs. old
 *       multi-step: run command â†’ parse JSON â†’ build entity â†’ save â†’ link).</li>
 *   <li><b>New entity model</b> â€” works with {@link MediaFileEntity} from
 *       {@code app.media.info}, decoupled from old {@code MediaFileInfoEntity}.</li>
 *   <li><b>Direct repository injection</b> â€” move/rename detection uses
 *       {@link MediaFileRepository} directly for entity-level updates.</li>
 *   <li><b>No {@code MediaFileNamingService} or {@code ProcessExecutor}
 *       dependencies</b> â€” those are encapsulated inside {@code MediaInfoService}.</li>
 * </ul>
 */
@Log4j2
@Service
public class FileWatcherService {

    private static final String TAG                   = "[FWATCH]";
    private static final long   FILE_STABILITY_SEC    = 5;
    private static final int    MAX_RETRY_ATTEMPTS    = 2;
    private static final long   RETRY_DELAY_BASE_MS   = 1_000;

    // â”€â”€ Dependencies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private final MediaInfoService       mediaInfoService;
    private final MediaFileRepository    mediaFileRepository;
    private final SymlinkService         symlinkService;
    private final CatalogService recordsService;
    private final AppProperties runtimeProperties;

    // â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private final WatchService watchService;
    private final Map<WatchKey, Path> watchKeys      = new ConcurrentHashMap<>();
    private final Set<Path>           registeredDirs = ConcurrentHashMap.newKeySet();
    private final Set<String> processingFiles        = ConcurrentHashMap.newKeySet();

    private final ExecutorService watcherExecutor =
            Executors.newSingleThreadExecutor(r -> {
                Thread t = new Thread(r, "file-watcher");
                t.setDaemon(true);
                return t;
            });

    private final ExecutorService fileProcessingExecutor;
    private final AtomicBoolean   running           = new AtomicBoolean(true);
    private final AtomicLong      processedCount    = new AtomicLong();
    private final AtomicLong      errorCount        = new AtomicLong();

    @Getter @Setter
    private volatile boolean dryRun = false;

    // â”€â”€ Constructor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    public FileWatcherService(
            MediaInfoService         mediaInfoService,
            MediaFileRepository      mediaFileRepository,
            SymlinkService           symlinkService,
            CatalogService   recordsService,
            AppProperties runtimeProperties
    ) throws IOException {
        this.mediaInfoService    = mediaInfoService;
        this.mediaFileRepository = mediaFileRepository;
        this.symlinkService      = symlinkService;
        this.recordsService      = recordsService;
        this.runtimeProperties   = runtimeProperties;

        int threads = Math.max(2, Runtime.getRuntime().availableProcessors() / 2);
        this.fileProcessingExecutor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "file-processor");
            t.setDaemon(true);
            return t;
        });

        this.watchService = FileSystems.getDefault().newWatchService();
        log.info("{} Initialized with {} processing threads", TAG, threads);
    }

    // â”€â”€ Lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @PostConstruct
    public void init() {
        // Start the watcher loop immediately (non-blocking â€” runs in watcherExecutor)
        startWatcher();
        // Register directories in the background so startup is not blocked by a
        // potentially large directory tree walk (e.g. /ext_hdisk/videos in production).
        Thread initThread = new Thread(() -> {
            try {
                Path basePath = runtimeProperties.getStreamPath();
                if (Files.notExists(basePath)) {
                    Files.createDirectories(basePath);
                    log.info("{} Created base directory: {}", TAG, basePath);
                }
                registerAll(basePath);
                scheduleStats();
                log.info("{} Watching {}, dryRun={}", TAG, basePath, dryRun);
            } catch (IOException e) {
                log.error("{} Failed to initialize file watcher: {}", TAG, e.getMessage(), e);
            }
        }, "file-watcher-init");
        initThread.setDaemon(true);
        initThread.start();
    }

    @PreDestroy
    public void shutdown() {
        running.set(false);
        shutdownExecutor(watcherExecutor,        "watcher");
        shutdownExecutor(fileProcessingExecutor, "processor");
        try { watchService.close(); } catch (IOException ignored) {}
        log.info("{} Stopped. processed={} errors={}", TAG, processedCount.get(), errorCount.get());
    }

    // â”€â”€ Directory registration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private void registerAll(Path start) throws IOException {
        if (!Files.exists(start)) return;
        final int[] count = {0};
        Files.walkFileTree(start, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
                registerDir(dir);
                count[0]++;
                return FileVisitResult.CONTINUE;
            }
            @Override
            public FileVisitResult visitFileFailed(Path file, IOException exc) {
                log.warn("{} Cannot visit: {}", TAG, file, exc);
                return FileVisitResult.CONTINUE;
            }
        });
        log.info("{} Registered {} directories under {}", TAG, count[0], start);
    }

    private void registerDir(Path dir) throws IOException {
        if (!registeredDirs.add(dir.toAbsolutePath())) return;
        try {
            WatchKey key = dir.register(watchService, ENTRY_CREATE, ENTRY_DELETE);
            watchKeys.put(key, dir);
        } catch (IOException e) {
            registeredDirs.remove(dir.toAbsolutePath());
            throw e;
        }
    }

    // â”€â”€ Watch loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private void startWatcher() {
        watcherExecutor.submit(() -> {
            log.info("{} Watcher thread started", TAG);
            while (running.get()) {
                WatchKey key;
                try {
                    key = watchService.take();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (ClosedWatchServiceException e) {
                    break;
                }

                Path dir = watchKeys.get(key);
                if (dir == null) { key.reset(); continue; }

                for (WatchEvent<?> event : key.pollEvents()) {
                    WatchEvent.Kind<?> kind = event.kind();
                    if (kind == OVERFLOW) {
                        log.warn("{} Overflow event for {}", TAG, dir);
                        continue;
                    }
                    Path full = dir.resolve((Path) event.context()).toAbsolutePath();
                    try {
                        if (kind == ENTRY_CREATE) {
                            handleCreateOrModifyEvent(full);
                        } else if (kind == ENTRY_DELETE) {
                            handleDeleteEvent(full);
                        }
                    } catch (Exception e) {
                        errorCount.incrementAndGet();
                        log.error("{} Error on {} -> {}", TAG, kind.name(), full, e);
                    }
                }

                if (!key.reset()) {
                    watchKeys.remove(key);
                    registeredDirs.remove(dir.toAbsolutePath());
                }
            }
            log.info("{} Watcher thread stopped", TAG);
        });
    }

    // â”€â”€ Event dispatch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private void handleCreateOrModifyEvent(Path path) {
        log.debug("{} FS event CREATE/MODIFY: {}", TAG, path);
        if (Files.isDirectory(path)) {
            try {
                registerAll(path);
                log.info("{} Registered new directory: {}", TAG, path);
            } catch (IOException e) {
                log.error("{} Cannot register new dir {}", TAG, path, e);
            }
        } else if (Files.isRegularFile(path)) {
            fileProcessingExecutor.submit(() -> {
                ThreadContext.put("traceId", "fwatch-" + UUID.randomUUID());
                try {
                    processFileEvent(path);
                } catch (Exception e) {
                    errorCount.incrementAndGet();
                    log.error("{} File event error: {}", TAG, path, e);
                } finally {
                    ThreadContext.clearAll();
                }
            });
        }
    }

    private void handleDeleteEvent(Path path) {
        log.debug("{} FS event DELETE: {}", TAG, path);
        fileProcessingExecutor.submit(() -> {
            ThreadContext.put("traceId", "fwatch-" + UUID.randomUUID());
            try {
                processDeleteEvent(path);
            } catch (Exception e) {
                errorCount.incrementAndGet();
                log.error("{} Delete event error: {}", TAG, path, e);
            } finally {
                ThreadContext.clearAll();
            }
        });
    }

    // â”€â”€ File event processing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private void processFileEvent(Path file) throws IOException {
        String filePath = file.toString();

        // In-memory deduplication (prevents race)
        if (!processingFiles.add(filePath)) {
            log.debug("{} Already processing: {}", TAG, filePath);
            return;
        }

        try {

            // Wait for the file to stabilise (no size change)
            if (!FileIdentityUtils.isStable(file, (int) FILE_STABILITY_SEC)) {
                log.debug("{} File not stable yet: {}", TAG, filePath);
                return;
            }

            // Resolve the owning cinema record from the path hierarchy
            var recordOpt = RecordPathResolver.resolveRecord(
                    file, recordsService::getRecordEntityOptById);

            if (recordOpt.isEmpty()) {
                log.debug("{} No record found for: {}", TAG, filePath);
                return;
            }

            Long recordId = recordOpt.get().getId();

            Optional<MediaFileEntity> existingByPath =
                    mediaFileRepository.findByFilePath(filePath);

            if (existingByPath.isPresent()) {
                log.debug("{} Already exists in DB: {}", TAG, filePath);
                return;
            }

            // Move / rename detection â€” compare size + partial hash against DB entries
            List<MediaFileEntity> existing = mediaFileRepository.findAllByRecordId(recordId);

            if (handleMoveOrRename(file, filePath, existing)) {
                processedCount.incrementAndGet();
                return;
            }

            // Skip files already tracked exactly
            boolean alreadyTracked = existing.stream()
                    .anyMatch(e -> filePath.equals(e.getFilePath()));
            if (alreadyTracked) {
                log.debug("{} Already tracked: {}", TAG, filePath);
                return;
            }

            // New file â€” collect metadata, persist, and create symlink
            log.info("{} New file for record {}: {}", TAG, recordId, filePath);
            processNewFile(file, recordId);
            processedCount.incrementAndGet();
        } finally {
            processingFiles.remove(filePath);
        }
    }

    private boolean handleMoveOrRename(Path file, String newPath,
                                       List<MediaFileEntity> existing) throws IOException {
        long newSize = Files.size(file);
        String newHash = FileIdentityUtils.partialHash(file);

        for (MediaFileEntity entity : existing) {
            if (!Objects.equals(entity.getFileSize(), newSize)) continue;

            String oldHash = FileIdentityUtils.partialHash(Path.of(entity.getFilePath()));
            if (!Objects.equals(newHash, oldHash)) continue;

            log.info("{} Move/Rename: {} -> {}", TAG, entity.getFilePath(), newPath);
            if (!dryRun) {
                entity.setFilePath(newPath);
                entity.setFileName(file.getFileName().toString());
                MediaFileEntity saved = mediaFileRepository.save(entity);
                ensureSystemLink(saved.getId(), saved.getFilePath());
            } else {
                log.info("{} [DRY RUN] Would update: {} -> {}", TAG, entity.getFilePath(), newPath);
            }
            return true;
        }
        return false;
    }

    /**
     * Delegates the full collect-parse-persist cycle to {@link MediaInfoService}.
     * One call replaces the old multi-step: execute command â†’ parse JSON â†’ build entities â†’ save.
     */
    private void processNewFile(Path file, Long recordId) {
        String filePath = file.toString();
        try {
            executeWithRetry(() -> {
                MediaFileDto dto = mediaInfoService.collectAndPersist(file, recordId, null);
                if (!dryRun) {
                    ensureSystemLink(dto.getId(), dto.getFilePath());
                    log.info("{} Saved id={} for: {}", TAG, dto.getId(), filePath);
                } else {
                    log.info("{} [DRY RUN] Would save for: {}", TAG, filePath);
                }
                return null;
            }, "collectAndPersist");
        } catch (Exception e) {
            throw new RuntimeException("Failed to process new file: " + filePath, e);
        }
    }

    private void processDeleteEvent(Path file) {
        String filePath = file.toString();
        mediaInfoService.getByFilePath(filePath).ifPresent(dto -> {
            log.warn("{} File deleted: {} (id={})", TAG, filePath, dto.getId());
            if (!dryRun) {
                mediaInfoService.deleteByFilePath(filePath);
                symlinkService.deleteById(dto.getId());
                log.info("{} Removed entry id={}", TAG, dto.getId());
            } else {
                log.info("{} [DRY RUN] Would remove entry id={}", TAG, dto.getId());
            }
            processedCount.incrementAndGet();
        });
    }

    private void ensureSystemLink(String fileId, String filePath) {
        try {
            symlinkService.ensure(fileId, filePath);
        } catch (DbWorldException ex) {
            log.warn("{} Link creation skipped for id={} path={}: {}",
                    TAG, fileId, filePath, ex.getMessage());
        }
    }

    // â”€â”€ Utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private <T> T executeWithRetry(java.util.concurrent.Callable<T> task, String name) throws Exception {
        Exception last = null;
        for (int attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
            try {
                return task.call();
            } catch (Exception e) {
                last = e;
                log.warn("{} {} attempt {}/{} failed: {}", TAG, name, attempt, MAX_RETRY_ATTEMPTS, e.getMessage());
                if (attempt < MAX_RETRY_ATTEMPTS) {
                    try { Thread.sleep(RETRY_DELAY_BASE_MS * attempt); }
                    catch (InterruptedException ie) { Thread.currentThread().interrupt(); throw ie; }
                }
            }
        }
        throw new RuntimeException("Failed to execute " + name + " after " + MAX_RETRY_ATTEMPTS + " attempts", last);
    }

    private void shutdownExecutor(ExecutorService exec, String name) {
        if (exec == null || exec.isShutdown()) return;
        exec.shutdown();
        try {
            if (!exec.awaitTermination(10, TimeUnit.SECONDS)) exec.shutdownNow();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            exec.shutdownNow();
        }
    }

    private void scheduleStats() {
        ScheduledExecutorService s = Executors.newSingleThreadScheduledExecutor(
                r -> { Thread t = new Thread(r, "watcher-stats"); t.setDaemon(true); return t; });
        s.scheduleAtFixedRate(() ->
                log.debug("{} Stats â€” processed={} errors={} dirs={}",
                        TAG, processedCount.get(), errorCount.get(), registeredDirs.size()),
                5, 5, TimeUnit.MINUTES);
    }

    // â”€â”€ Spring Integration entry points â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    public void handleCreateOrModify(Message<File> message) {
        logMessage("handleCreateOrModify", message);
        handleCreateOrModifyEvent(message.getPayload().toPath());
    }

    public void handleDelete(Message<File> message) {
        logMessage("handleDelete", message);
        handleDeleteEvent(message.getPayload().toPath());
    }

    private void logMessage(String method, Message<File> message) {
        if (log.isDebugEnabled()) {
            MessageHeaders h = message.getHeaders();
            log.debug("{} [{}] file={}", TAG, method, message.getPayload());
            if (log.isTraceEnabled()) {
                h.forEach((k, v) -> log.trace("{} [{}] header {}={}", TAG, method, k, v));
            }
        }
    }

    // â”€â”€ Public metrics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    public long getProcessedCount()       { return processedCount.get(); }
    public long getErrorCount()           { return errorCount.get(); }
    public int  getWatchedDirectoryCount(){ return registeredDirs.size(); }
    public boolean isRunning()            { return running.get(); }
}
