package com.db.dbworld.services.explorer;

import com.db.dbworld.dao.fileexplorer.FileRepository;
import com.db.dbworld.entities.fileexplorer.FileEntity;
import com.db.dbworld.payloads.fileexplorer.FileDto;
import com.db.dbworld.services.media.MediaFileInfoService;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;

import static java.nio.file.StandardWatchEventKinds.*;

@Slf4j
@Service
public class RecursiveFileWatcherService {

    @Autowired
    private final FileRepository fileRepository;
    private final WatchService watchService;
    // Map to track registered directories.
    private final Map<WatchKey, Path> watchKeys = new HashMap<>();

    @Autowired
    private ModelMapper modelMapper;

    @Autowired
    private MediaFileInfoService mediaFileInfoService;

    @Value("${dbworld.paths.streamHomePath}")
    private String baseDirectory;

    public RecursiveFileWatcherService(FileRepository fileRepository) throws IOException {
        this.fileRepository = fileRepository;
        this.watchService = FileSystems.getDefault().newWatchService();
    }

    @PostConstruct
    public void init() throws IOException {
        Path basePath = Paths.get(baseDirectory).toAbsolutePath();
        // Initially scan and register the entire tree.
        registerAll(basePath);
        startWatcher();
    }

    /**
     * Recursively register all directories under the given start path.
     * Also, add all files and folders to the database if they are missing.
     */
    private void registerAll(final Path start) throws IOException {
        Files.walkFileTree(start, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
                register(dir);
                // Also add the directory record if missing.
                addOrUpdateRecord(dir);
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                // Add file record if missing.
                addOrUpdateRecord(file);
                return FileVisitResult.CONTINUE;
            }
        });
    }

    /**
     * Register a single directory with the WatchService.
     */
    private void register(Path dir) throws IOException {
        WatchKey key = dir.register(watchService, ENTRY_CREATE, ENTRY_MODIFY, ENTRY_DELETE);
        watchKeys.put(key, dir);
        log.info("Registered directory: {}", dir);
    }

    /**
     * Add a file or folder record to the database if not already present.
     */
    private void addOrUpdateRecord(Path path) {
        String absolutePath = path.toAbsolutePath().toString();
        try {
            BasicFileAttributes attrs = Files.readAttributes(path, BasicFileAttributes.class);
            Date creationDate = new Date(attrs.creationTime().toMillis());
            Date lastModifiedDate = new Date(attrs.lastModifiedTime().toMillis());
            boolean isDir = Files.isDirectory(path);
            FileEntity entity = fileRepository.findByFilePath(absolutePath);
            if (entity == null) {
                entity = modelMapper.map(new FileDto(path), FileEntity.class);
                fileRepository.save(entity);
                log.info("Inserted new {} record: {}", isDir ? "folder" : "file", absolutePath);
            }
//            else {
//                // Optionally update modified timestamp or other attributes.
//                entity.setLastModifyDate(lastModifiedDate.toInstant());
//                fileRepository.save(entity);
//                log.info("Updated record: {}", absolutePath);
//            }
        } catch (IOException e) {
            log.error("Error reading attributes for path: {}", absolutePath, e);
        }
    }

    /**
     * Start the background thread to process file system events.
     */
    private void startWatcher() {
        Executors.newSingleThreadExecutor().submit(() -> {
            while (true) {
                WatchKey key;
                try {
                    key = watchService.take();
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    break;
                }
                Path dir = watchKeys.get(key);
                if (dir == null) {
                    log.warn("WatchKey not recognized!");
                    continue;
                }
                for (WatchEvent<?> event : key.pollEvents()) {
                    WatchEvent.Kind<?> kind = event.kind();
                    if (kind == OVERFLOW) {
                        continue;
                    }
                    WatchEvent<Path> ev = (WatchEvent<Path>) event;
                    Path relativePath = ev.context();
                    Path fullPath = dir.resolve(relativePath).toAbsolutePath();
                    String absolutePath = fullPath.toString();
                    log.info("Event {} on {}", kind.name(), absolutePath);

                    try {
                        if (kind == ENTRY_CREATE) {
                            // If a new directory is created, register it recursively and scan its contents.
                            if (Files.isDirectory(fullPath)) {
                                registerAll(fullPath);
                            }
                            // Whether file or directory, add or update record.
                            addOrUpdateRecord(fullPath);
                        } else if (kind == ENTRY_MODIFY) {
                            if (Files.exists(fullPath)) {
                                addOrUpdateRecord(fullPath);
                            }
                        } else if (kind == ENTRY_DELETE) {
                            // On deletion, remove the record.
                            FileEntity entity = fileRepository.findByFilePath(absolutePath);
                            if (entity != null) {
                                if (entity.isDirectory()) {
                                    // Delete any child records as well.
                                    List<FileEntity> children = fileRepository.findByFilePathStartingWith(absolutePath);
                                    fileRepository.deleteAll(children);
                                    children.forEach(fileEntity -> mediaFileInfoService.deleteInfoByFilePath(fileEntity.getFilePath()));
                                    log.info("Removed child records for deleted folder: {}", absolutePath);
                                }
                                fileRepository.delete(entity);
                                mediaFileInfoService.deleteInfoByFilePath(entity.getFilePath());
                                log.info("Removed record for deleted path: {}", absolutePath);
                            }
                        }
                    } catch (Exception e) {
                        log.error("Error processing event for path: {}", absolutePath, e);
                    }
                }
                if (!key.reset()) {
                    watchKeys.remove(key);
                    if (watchKeys.isEmpty()) {
                        log.warn("All watch keys have been invalidated; stopping watcher.");
                        break;
                    }
                }
            }
        });
    }
}
