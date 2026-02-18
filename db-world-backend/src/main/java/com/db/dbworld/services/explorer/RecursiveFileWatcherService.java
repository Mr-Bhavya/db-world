//package com.db.dbworld.services.explorer;
//
//import com.db.dbworld.dao.fileexplorer.FileRepository;
//import com.db.dbworld.entities.fileexplorer.FileEntity;
//import com.db.dbworld.payloads.fileexplorer.FileDto;
//import com.db.dbworld.services.media.MediaFileInfoService;
//import jakarta.annotation.PostConstruct;
//import lombok.extern.slf4j.Slf4j;
//import org.modelmapper.ModelMapper;
//import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.beans.factory.annotation.Value;
//import org.springframework.stereotype.Service;
//
//import java.io.IOException;
//import java.nio.file.*;
//import java.nio.file.attribute.BasicFileAttributes;
//import java.util.Date;
//import java.util.HashMap;
//import java.util.List;
//import java.util.Map;
//import java.util.concurrent.Executors;
//
//import static java.nio.file.StandardWatchEventKinds.*;
//
//@Slf4j
//@Service
//public class RecursiveFileWatcherService {
//
//    private final FileRepository fileRepository;
//    private final WatchService watchService;
//    private final Map<WatchKey, Path> watchKeys = new HashMap<>();
//
//    @Autowired private ModelMapper modelMapper;
//    @Autowired private MediaFileInfoService mediaFileInfoService;
//
//    @Value("${app.stream-path}")
//    private String baseDirectory;
//
//    @Autowired
//    public RecursiveFileWatcherService(FileRepository fileRepository) throws IOException {
//        this.fileRepository = fileRepository;
//        this.watchService = FileSystems.getDefault().newWatchService();
//    }
//
//    @PostConstruct
//    public void init() throws IOException {
//        Path basePath = Paths.get(baseDirectory).toAbsolutePath();
//        registerAll(basePath);
//        startWatcher();
//    }
//
//    /* ========================= INITIAL SCAN ========================= */
//
//    private void registerAll(final Path start) throws IOException {
//        Files.walkFileTree(start, new SimpleFileVisitor<>() {
//            @Override
//            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
//                register(dir);
//                addOrUpdateRecord(dir);
//                return FileVisitResult.CONTINUE;
//            }
//
//            @Override
//            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
//                addOrUpdateRecord(file);
//                return FileVisitResult.CONTINUE;
//            }
//        });
//    }
//
//    private void register(Path dir) throws IOException {
//        WatchKey key = dir.register(watchService, ENTRY_CREATE, ENTRY_MODIFY, ENTRY_DELETE);
//        watchKeys.put(key, dir);
//        log.debug("Registered directory: {}", dir);
//    }
//
//    /* ========================= DB SYNC ========================= */
//
//    private void addOrUpdateRecord(Path path) {
//        String absolutePath = path.toAbsolutePath().toString();
//        try {
//            BasicFileAttributes attrs = Files.readAttributes(path, BasicFileAttributes.class);
//            boolean isDir = attrs.isDirectory();
//            FileEntity entity = fileRepository.findByFilePath(absolutePath);
//
//            if (entity == null) {
//                entity = modelMapper.map(new FileDto(path), FileEntity.class);
//                entity.setCreationTime(new Date(attrs.creationTime().toMillis()));
//                entity.setLastModifiedTime(new Date(attrs.lastModifiedTime().toMillis()));
//                fileRepository.save(entity);
//                log.info("Inserted {} record: {}", isDir ? "directory" : "file", absolutePath);
//            }
//
//        } catch (IOException e) {
//            log.error("Failed to read attributes for {}", absolutePath, e);
//        }
//    }
//
//    /* ========================= WATCH LOOP ========================= */
//
//    private void startWatcher() {
//        Executors.newSingleThreadExecutor().submit(() -> {
//            while (true) {
//                WatchKey key;
//                try {
//                    key = watchService.take();
//                } catch (InterruptedException e) {
//                    Thread.currentThread().interrupt();
//                    break;
//                }
//
//                Path dir = watchKeys.get(key);
//                if (dir == null) {
//                    log.warn("Unrecognized WatchKey");
//                    continue;
//                }
//
//                for (WatchEvent<?> event : key.pollEvents()) {
//                    WatchEvent.Kind<?> kind = event.kind();
//                    if (kind == OVERFLOW) continue;
//
//                    Path name = ((WatchEvent<Path>) event).context();
//                    Path fullPath = dir.resolve(name).toAbsolutePath();
//                    String absolutePath = fullPath.toString();
//
//                    try {
//                        if (kind == ENTRY_CREATE) {
//                            if (Files.isDirectory(fullPath)) registerAll(fullPath);
//                            addOrUpdateRecord(fullPath);
//                        } else if (kind == ENTRY_MODIFY) {
//                            if (Files.exists(fullPath)) addOrUpdateRecord(fullPath);
//                        } else if (kind == ENTRY_DELETE) {
//                            handleDeleteEvent(absolutePath);
//                        }
//                    } catch (Exception e) {
//                        log.error("Error processing {} for {}", kind.name(), absolutePath, e);
//                    }
//                }
//
//                if (!key.reset()) {
//                    watchKeys.remove(key);
//                    if (watchKeys.isEmpty()) {
//                        log.warn("All watch keys invalidated, stopping watcher");
//                        break;
//                    }
//                }
//            }
//        });
//    }
//
//    /* ========================= DELETE HANDLING ========================= */
//
//    private void handleDeleteEvent(String absolutePath) {
//        FileEntity entity = fileRepository.findByFilePath(absolutePath);
//        if (entity == null) return;
//
//        if (entity.isDirectory()) {
//            List<FileEntity> children = fileRepository.findByFilePathStartingWith(absolutePath);
//            fileRepository.deleteAll(children);
//            children.forEach(child -> mediaFileInfoService.deleteInfoByFilePath(child.getFilePath()));
//            log.info("Deleted folder and child records: {}", absolutePath);
//        }
//
//        fileRepository.delete(entity);
//        mediaFileInfoService.deleteInfoByFilePath(entity.getFilePath());
//        log.info("Deleted record and media info for {}", absolutePath);
//    }
//}
