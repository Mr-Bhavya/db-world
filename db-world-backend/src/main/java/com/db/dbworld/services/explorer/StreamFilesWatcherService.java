package com.db.dbworld.services.explorer;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.entities.dbcinema.stream.MediaFileInfoEntity;
import com.db.dbworld.helpers.ProcessExecutor;
import com.db.dbworld.services.cinema.DBCinemaRecordsService;
import com.db.dbworld.services.media.MediaFileInfoService;
import com.db.dbworld.services.media.MediaFileNamingService;
import com.db.dbworld.services.media.MediaFileUtils;
import com.db.dbworld.services.media.SystemLinkService;
import com.db.dbworld.utils.*;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.log4j.Log4j2;
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

@Log4j2
@Service
public class StreamFilesWatcherService {

    private static final String LOG_PREFIX = "[WATCH]";
    private static final long FILE_STABILITY_CHECK_SEC = 5;
    private static final int MAX_RETRY_ATTEMPTS = 1;
    private static final long RETRY_DELAY_MS = 1000;

    private final WatchService watchService;
    private final Map<WatchKey, Path> watchKeys = new ConcurrentHashMap<>();
    private final Set<Path> registeredDirs = ConcurrentHashMap.newKeySet();

    private final MediaFileInfoService mediaService;
    private final DBCinemaRecordsService recordsService;
    private final SystemLinkService systemLinkService;
    private final DbWorldRuntimeProperties runtimeProperties;
    private final MediaFileNamingService mediaFileNamingService;
    private final MediaFileUtils mediaFileUtils;
    private final ProcessExecutor processExecutor;

    private final ExecutorService watcherExecutor =
            Executors.newSingleThreadExecutor(r -> {
                Thread t = new Thread(r, "stream-file-watcher");
                t.setDaemon(true);
                return t;
            });

    private final ExecutorService fileProcessingExecutor;
    private final AtomicBoolean running = new AtomicBoolean(true);
    private final AtomicLong processedFileCount = new AtomicLong(0);
    private final AtomicLong errorCount = new AtomicLong(0);

    @Getter
    @Setter
    private volatile boolean dryRun = false;

    public StreamFilesWatcherService(MediaFileInfoService mediaService,
                                     DBCinemaRecordsService recordsService,
                                     SystemLinkService systemLinkService,
                                     DbWorldRuntimeProperties runtimeProperties,
                                     MediaFileNamingService mediaFileNamingService,
                                     MediaFileUtils mediaFileUtils,
                                     ProcessExecutor processExecutor) throws IOException {
        this.mediaService = mediaService;
        this.recordsService = recordsService;
        this.systemLinkService = systemLinkService;
        this.runtimeProperties = runtimeProperties;
        this.mediaFileNamingService = mediaFileNamingService;
        this.mediaFileUtils = mediaFileUtils;
        this.processExecutor = processExecutor;

        // Configure file processing thread pool
        int processors = Runtime.getRuntime().availableProcessors();
        this.fileProcessingExecutor = Executors.newFixedThreadPool(
                Math.max(2, processors / 2),
                r -> {
                    Thread t = new Thread(r, "file-processor-" + System.currentTimeMillis());
                    t.setDaemon(true);
                    return t;
                }
        );

        this.watchService = FileSystems.getDefault().newWatchService();

        log.info("{} Service initialized with {} processing threads", LOG_PREFIX,
                Math.max(2, processors / 2));
    }

    /* ========================= INIT ========================= */

    @PostConstruct
    public void init() {
        try {
            Path basePath = runtimeProperties.getStreamPath();
            if (Files.notExists(basePath)) {
                log.warn("{} Base path does not exist: {}", LOG_PREFIX, basePath);
                Files.createDirectories(basePath);
                log.info("{} Created base directory: {}", LOG_PREFIX, basePath);
            }

            registerAll(basePath);
            startWatcher();
            log.info("{} Stream watcher initialized at {}", LOG_PREFIX, basePath);
            log.info("{} Dry run mode: {}", LOG_PREFIX, dryRun);

            // Schedule periodic stats logging
            scheduleStatsLogging();

        } catch (IOException e) {
            log.error("{} Failed to initialize watcher", LOG_PREFIX, e);
            throw new RuntimeException("Failed to initialize StreamFilesWatcherService", e);
        }
    }

    @PreDestroy
    public void shutdown() {
        log.info("{} Starting shutdown process...", LOG_PREFIX);
        running.set(false);

        // Shutdown executors gracefully
        shutdownExecutor(watcherExecutor, "WatcherExecutor");
        shutdownExecutor(fileProcessingExecutor, "FileProcessingExecutor");

        // Close watch service
        closeWatchService();

        log.info("{} Stream watcher stopped. Processed {} files, {} errors",
                LOG_PREFIX, processedFileCount.get(), errorCount.get());
    }

    private void shutdownExecutor(ExecutorService executor, String name) {
        if (executor != null && !executor.isShutdown()) {
            try {
                executor.shutdown();
                if (!executor.awaitTermination(10, TimeUnit.SECONDS)) {
                    log.warn("{} {} did not terminate gracefully, forcing shutdown", LOG_PREFIX, name);
                    executor.shutdownNow();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                executor.shutdownNow();
            }
        }
    }

    private void closeWatchService() {
        if (watchService != null) {
            try {
                watchService.close();
                log.debug("{} Watch service closed", LOG_PREFIX);
            } catch (IOException e) {
                log.warn("{} Error closing watch service", LOG_PREFIX, e);
            }
        }
    }

    /* ========================= DIRECTORY REGISTRATION ========================= */

    private void registerAll(Path start) throws IOException {
        if (!Files.exists(start)) {
            log.warn("{} Cannot register non-existent path: {}", LOG_PREFIX, start);
            return;
        }

        log.debug("{} Starting directory registration for: {}", LOG_PREFIX, start);
        final int[] registeredCount = {0};

        Files.walkFileTree(start, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
                registerDir(dir);
                registeredCount[0]++;
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFileFailed(Path file, IOException exc) throws IOException {
                log.warn("{} Failed to visit file: {}", LOG_PREFIX, file, exc);
                return FileVisitResult.CONTINUE;
            }
        });

        log.info("{} Registered {} directories under {}", LOG_PREFIX, registeredCount[0], start);
    }

    private void registerDir(Path dir) throws IOException {
        Path absolutePath = dir.toAbsolutePath();
        if (!registeredDirs.add(absolutePath)) {
            log.trace("{} Directory already registered: {}", LOG_PREFIX, absolutePath);
            return;
        }

        try {
            WatchKey key = dir.register(watchService, ENTRY_CREATE, ENTRY_MODIFY, ENTRY_DELETE);
            watchKeys.put(key, dir);
            log.debug("{} Registered directory: {}", LOG_PREFIX, dir);
        } catch (IOException e) {
            log.error("{} Failed to register directory: {}", LOG_PREFIX, dir, e);
            registeredDirs.remove(absolutePath);
            throw e;
        }
    }

    /* ========================= WATCH LOOP ========================= */

    private void startWatcher() {
        watcherExecutor.submit(() -> {
            log.info("{} Watcher thread started", LOG_PREFIX);

            while (running.get()) {
                WatchKey key;
                try {
                    key = watchService.take();
                    log.trace("{} Watch event received", LOG_PREFIX);
                } catch (InterruptedException e) {
                    if (running.get()) {
                        log.warn("{} Watcher thread interrupted unexpectedly", LOG_PREFIX);
                    }
                    Thread.currentThread().interrupt();
                    break;
                } catch (ClosedWatchServiceException e) {
                    log.info("{} Watch service closed, stopping watcher", LOG_PREFIX);
                    break;
                }

                Path dir = watchKeys.get(key);
                if (dir == null) {
                    log.warn("{} Unknown WatchKey received, skipping", LOG_PREFIX);
                    key.reset();
                    continue;
                }

                processWatchEvents(key, dir);
            }

            log.info("{} Watcher thread stopped", LOG_PREFIX);
        });
    }

    private void processWatchEvents(WatchKey key, Path dir) {
        for (WatchEvent<?> event : key.pollEvents()) {
            WatchEvent.Kind<?> kind = event.kind();

            if (kind == OVERFLOW) {
                log.warn("{} Overflow event detected for directory: {}", LOG_PREFIX, dir);
                continue;
            }

            Path relative = (Path) event.context();
            Path fullPath = dir.resolve(relative).toAbsolutePath();

            logEventDetails(kind, fullPath);

            try {
                if (kind == ENTRY_CREATE || kind == ENTRY_MODIFY) {
                    handleCreateOrModifyEvent(kind, fullPath);
                } else if (kind == ENTRY_DELETE) {
                    handleDeleteEvent(fullPath);
                }
            } catch (Exception e) {
                errorCount.incrementAndGet();
                log.error("{} Error processing {} -> {}", LOG_PREFIX, kind.name(), fullPath, e);
            }
        }

        if (!key.reset()) {
            watchKeys.remove(key);
            Path absoluteDir = dir.toAbsolutePath();
            registeredDirs.remove(absoluteDir);
            log.warn("{} WatchKey invalidated for {}. Removed from tracking.", LOG_PREFIX, dir);
        }
    }

    private void logEventDetails(WatchEvent.Kind<?> kind, Path fullPath) {
        if (log.isDebugEnabled()) {
            try {
                if (Files.exists(fullPath)) {
                    log.debug("{} Event: {} -> {} (Size: {}, Dir: {})",
                            LOG_PREFIX, kind.name(), fullPath,
                            Files.isDirectory(fullPath) ? "DIR" :
                                    Files.size(fullPath) + " bytes",
                            Files.isDirectory(fullPath));
                } else {
                    log.debug("{} Event: {} -> {} (File does not exist)",
                            LOG_PREFIX, kind.name(), fullPath);
                }
            } catch (IOException e) {
                log.debug("{} Event: {} -> {} (Cannot read attributes)",
                        LOG_PREFIX, kind.name(), fullPath);
            }
        }
    }

    /* ========================= EVENT HANDLING ========================= */

    private void handleCreateOrModifyEvent(WatchEvent.Kind<?> kind, Path fullPath) {
        if (Files.isDirectory(fullPath)) {
            try {
                log.debug("{} New directory detected: {}", LOG_PREFIX, fullPath);
                registerAll(fullPath);
            } catch (IOException e) {
                log.error("{} Failed to register new directory: {}", LOG_PREFIX, fullPath, e);
            }
        } else if (Files.isRegularFile(fullPath)) {
            // Process file asynchronously
            fileProcessingExecutor.submit(() -> {
                try {
                    processFileEvent(fullPath, kind);
                } catch (Exception e) {
                    errorCount.incrementAndGet();
                    log.error("{} Failed to process file event: {}", LOG_PREFIX, fullPath, e);
                }
            });
        }
    }

    private void handleDeleteEvent(Path fullPath) {
        fileProcessingExecutor.submit(() -> {
            try {
                processDeleteEvent(fullPath);
            } catch (Exception e) {
                errorCount.incrementAndGet();
                log.error("{} Failed to process delete event: {}", LOG_PREFIX, fullPath, e);
            }
        });
    }

    /* ========================= FILE PROCESSING ========================= */

    private void processFileEvent(Path file, WatchEvent.Kind<?> kind) {
        long startTime = System.currentTimeMillis();
        String filePath = file.toString();

        try {
            log.debug("{} Processing {} event for: {}", LOG_PREFIX, kind.name(), filePath);

            // Check if file is stable
            if (!FileIdentityUtils.isStable(file, (int) FILE_STABILITY_CHECK_SEC)) {
                log.debug("{} File not stable yet, skipping: {}", LOG_PREFIX, filePath);
                return;
            }

            // Resolve record
            Optional<DBCinemaRecordsEntity> recordOpt =
                    RecordPathResolver.resolveRecord(file, recordsService::getRecordEntityOptById);

            if (recordOpt.isEmpty()) {
                log.debug("{} No record found for file: {}", LOG_PREFIX, filePath);
                return;
            }

            DBCinemaRecordsEntity record = recordOpt.get();
            log.debug("{} Found record ID {} for file: {}", LOG_PREFIX, record.getId(), filePath);

            // Check for existing file entries
            List<MediaFileInfoEntity> existing =
                    mediaService.getAllFileInfoEntityByRecordId(record.getId());

            // Handle move/rename detection
            if (handleMoveRenameDetection(file, record, existing)) {
                processedFileCount.incrementAndGet();
                logProcessingTime(startTime, filePath, "move/rename");
                return;
            }

            // Check if file already exists in database
            if (isFileAlreadyTracked(filePath, existing)) {
                log.debug("{} File already tracked: {}", LOG_PREFIX, filePath);
                return;
            }

            // Process new file
            log.info("{} New file detected for record {}: {}", LOG_PREFIX, record.getId(), filePath);

            processNewFile(file, record);

            processedFileCount.incrementAndGet();
            logProcessingTime(startTime, filePath, "new file");

        } catch (Exception e) {
            errorCount.incrementAndGet();
            log.error("{} Failed processing file: {}", LOG_PREFIX, filePath, e);
        }
    }

    private boolean handleMoveRenameDetection(Path file, DBCinemaRecordsEntity record,
                                              List<MediaFileInfoEntity> existing) throws IOException {
        long size = Files.size(file);
        String hash = FileIdentityUtils.partialHash(file);
        String path = file.toString();

        for (MediaFileInfoEntity e : existing) {
            if (Objects.equals(e.getFileSize(), size)) {
                String existingHash = FileIdentityUtils.partialHash(Path.of(e.getFilePath()));

                if (Objects.equals(hash, existingHash)) {
                    log.info("{} Move/Rename detected: {} -> {}", LOG_PREFIX, e.getFilePath(), path);

                    if (!dryRun) {
                        updateFileEntity(e, path, record);
                    } else {
                        log.info("{} [DRY RUN] Would update moved file: {} -> {}",
                                LOG_PREFIX, e.getFilePath(), path);
                    }
                    return true;
                }
            }
        }
        return false;
    }

    private void updateFileEntity(MediaFileInfoEntity entity, String newPath, DBCinemaRecordsEntity record) {
        entity.setFilePath(newPath);
        entity.initialize(record);

        try {
            entity = mediaService.save(entity);
            systemLinkService.ensure(entity);
            log.info("{} Updated file path to: {}", LOG_PREFIX, newPath);
        } catch (Exception e) {
            log.error("{} Failed to update file entity: {}", LOG_PREFIX, newPath, e);
            throw e;
        }
    }

    private boolean isFileAlreadyTracked(String filePath, List<MediaFileInfoEntity> existing) {
        return existing.stream()
                .anyMatch(e -> filePath.equals(e.getFilePath()));
    }

    private void processNewFile(Path file, DBCinemaRecordsEntity record) {
        String filePath = file.toString();

        try {
            // Get file info with retry logic
            String json = executeWithRetry(() ->
                            processExecutor.runMediaInfoCommand(file),
                    "MediaInfo command"
            );

            // Parse media info
            List<MediaFileInfoEntity> entities = mediaFileNamingService.parseMediaInfoJson(
                    mediaFileUtils.createMediaFileDetails(filePath).orElse(null),
                    json
            );

            // Save entities
            long size = Files.size(file);
            for (MediaFileInfoEntity entity : entities) {
                if (!dryRun) {
                    entity.setFilePath(filePath);
                    entity.setFileSize(size);
                    entity.initialize(record);

                    entity = mediaService.save(entity);
                    systemLinkService.ensure(entity);
                } else {
                    log.info("{} [DRY RUN] Would save entity for new file: {}", LOG_PREFIX, filePath);
                }

                log.debug("{} Saved entity ID {} for file: {}",
                        LOG_PREFIX, entity.getId(), filePath);
            }

            log.info("{} Successfully processed new file: {}", LOG_PREFIX, filePath);

        } catch (Exception e) {
            log.error("{} Failed to process new file: {}", LOG_PREFIX, filePath, e);
            throw new RuntimeException("Failed to process new file: " + filePath, e);
        }
    }

    private void processDeleteEvent(Path file) {
        String filePath = file.toString();
        long startTime = System.currentTimeMillis();

        try {
            mediaService.findOneByFilePath(filePath)
                    .ifPresent(entity -> {
                        log.warn("{} File deleted: {} (Entity ID: {})",
                                LOG_PREFIX, filePath, entity.getId());

                        if (!dryRun) {
                            try {
                                mediaService.deleteInfoById(entity.getId());
                                systemLinkService.deleteById(entity.getId());
                                log.info("{} Removed entity ID {} for deleted file: {}",
                                        LOG_PREFIX, entity.getId(), filePath);
                            } catch (Exception e) {
                                log.error("{} Failed to remove entity for deleted file: {}",
                                        LOG_PREFIX, filePath, e);
                            }
                        } else {
                            log.info("{} [DRY RUN] Would remove entity for deleted file: {}",
                                    LOG_PREFIX, filePath);
                        }

                        processedFileCount.incrementAndGet();
                        logProcessingTime(startTime, filePath, "delete");
                    });

        } catch (Exception e) {
            errorCount.incrementAndGet();
            log.error("{} Failed to process delete event: {}", LOG_PREFIX, filePath, e);
        }
    }

    /* ========================= HELPER METHODS ========================= */

    private <T> T executeWithRetry(Callable<T> task, String taskName) throws Exception {
        Exception lastException = null;

        for (int attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
            try {
                return task.call();
            } catch (Exception e) {
                lastException = e;
                log.warn("{} {} failed (attempt {}/{}): {}",
                        LOG_PREFIX, taskName, attempt, MAX_RETRY_ATTEMPTS, e.getMessage());

                if (attempt < MAX_RETRY_ATTEMPTS) {
                    try {
                        Thread.sleep(RETRY_DELAY_MS * attempt);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw ie;
                    }
                }
            }
        }

        throw new RuntimeException("Failed to execute " + taskName + " after " +
                MAX_RETRY_ATTEMPTS + " attempts", lastException);
    }

    private void logProcessingTime(long startTime, String filePath, String operation) {
        if (log.isDebugEnabled()) {
            long duration = System.currentTimeMillis() - startTime;
            log.debug("{} {} completed in {}ms: {}",
                    LOG_PREFIX, operation, duration, filePath);
        }
    }

    private void scheduleStatsLogging() {
        ScheduledExecutorService statsExecutor = Executors.newSingleThreadScheduledExecutor(
                r -> new Thread(r, "watcher-stats-logger")
        );

        statsExecutor.scheduleAtFixedRate(() -> {
            if (log.isDebugEnabled()) {
                log.debug("{} Stats - Processed: {}, Errors: {}, Active dirs: {}, Dry run: {}",
                        LOG_PREFIX, processedFileCount.get(), errorCount.get(),
                        registeredDirs.size(), dryRun);
            }
        }, 5, 5, TimeUnit.MINUTES);

        // Register shutdown hook for stats executor
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            statsExecutor.shutdown();
            try {
                if (!statsExecutor.awaitTermination(5, TimeUnit.SECONDS)) {
                    statsExecutor.shutdownNow();
                }
            } catch (InterruptedException e) {
                statsExecutor.shutdownNow();
            }
        }));
    }

    /* ========================= SPRING INTEGRATION ENTRY ========================= */

    public void handleCreateOrModify(Message<File> message) {
        logIncomingMessage("handleCreateOrModify", message);
        handleCreateOrModifyEvent(ENTRY_CREATE, message.getPayload().toPath());
    }

    public void handleDelete(Message<File> message) {
        logIncomingMessage("handleDelete", message);
        handleDeleteEvent(message.getPayload().toPath());
    }

    private void logIncomingMessage(String method, Message<File> message) {
        if (log.isDebugEnabled()) {
            log.debug("{} Received {} message for file: {}",
                    LOG_PREFIX, method, message.getPayload());
            logHeaders(method, message.getHeaders());
        }
    }

    private void logHeaders(String method, MessageHeaders headers) {
        if (log.isTraceEnabled()) {
            headers.forEach((k, v) ->
                    log.trace("{} [Method: {}] Key: {} - Value: {}", LOG_PREFIX, method, k, v));
        }
    }

    /* ========================= PUBLIC UTILITY METHODS ========================= */

    public long getProcessedFileCount() {
        return processedFileCount.get();
    }

    public long getErrorCount() {
        return errorCount.get();
    }

    public int getWatchedDirectoryCount() {
        return registeredDirs.size();
    }

    public boolean isRunning() {
        return running.get();
    }

}