package com.db.dbworld.app.filemanager.upload;

import com.db.dbworld.app.filemanager.dto.FileItemDto;
import com.db.dbworld.app.filemanager.location.FileLocationService;
import com.db.dbworld.app.filemanager.mapper.FileMetadataMapper;
import com.db.dbworld.app.filemanager.path.PathJail;
import com.db.dbworld.app.filemanager.upload.dto.InitUploadRequest;
import com.db.dbworld.app.filemanager.upload.dto.UploadSessionDto;
import com.db.dbworld.config.AppProperties;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.utils.FileIdentityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

/** Resumable chunked upload sessions: init -> appendChunk* -> complete (or abort). */
@Log4j2
@Service
@RequiredArgsConstructor
public class UploadSessionService {

    public static final int DEFAULT_CHUNK_SIZE = 8_388_608; // 8 MiB
    public static final String DEFAULT_ON_CONFLICT = "fail";

    private final UploadSessionRepository repo;
    private final FileLocationService locationService;
    private final AppProperties appProperties;

    public UploadSessionDto init(InitUploadRequest req) throws IOException {
        locationService.resolveBase(req.locationId()); // validates location exists & is enabled
        int chunkSize = (req.chunkSize() == null || req.chunkSize() <= 0) ? DEFAULT_CHUNK_SIZE : req.chunkSize();
        String onConflict = req.onConflict() != null ? req.onConflict() : DEFAULT_ON_CONFLICT;

        UploadSessionEntity entity = UploadSessionEntity.builder()
                .locationId(req.locationId())
                .targetPath(req.path())
                .fileName(req.fileName())
                .totalSize(req.totalSize())
                .chunkSize(chunkSize)
                .receivedBytes(0L)
                .nextIndex(0)
                .checksum(req.checksum())
                .onConflict(onConflict)
                .status("PENDING")
                .build();
        entity = repo.save(entity);

        Path uploadsDir = uploadsDir();
        Files.createDirectories(uploadsDir);
        Path part = uploadsDir.resolve(entity.getId() + ".part");
        try (RandomAccessFile raf = new RandomAccessFile(part.toFile(), "rw")) {
            raf.setLength(0);
        }

        log.info("Upload session initialized id={} locationId={} path={} fileName={} chunkSize={}",
                entity.getId(), req.locationId(), req.path(), req.fileName(), chunkSize);
        return toDto(entity);
    }

    public UploadSessionDto appendChunk(String uploadId, int index, byte[] data) throws IOException {
        UploadSessionEntity entity = getOrThrow(uploadId);

        // Idempotent no-op: chunk already received (e.g. client retry after a dropped ack).
        if (index < entity.getNextIndex()) {
            return toDto(entity);
        }
        // Chunks must be written strictly in order so the assembled file is contiguous;
        // an ahead-of-sequence chunk would zero-fill the gap and silently corrupt the file.
        if (index > entity.getNextIndex()) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST,
                    "Out-of-order chunk: expected index " + entity.getNextIndex() + " but got " + index);
        }

        Path part = partFile(uploadId);
        try (RandomAccessFile raf = new RandomAccessFile(part.toFile(), "rw");
             FileChannel channel = raf.getChannel()) {
            long offset = (long) index * entity.getChunkSize();
            channel.write(ByteBuffer.wrap(data), offset);
        }
        entity.setReceivedBytes(entity.getReceivedBytes() + data.length);
        entity.setNextIndex(index + 1);
        repo.save(entity);
        return toDto(entity);
    }

    public UploadSessionDto status(String uploadId) {
        return toDto(getOrThrow(uploadId));
    }

    public FileItemDto complete(String uploadId) throws IOException {
        UploadSessionEntity entity = getOrThrow(uploadId);
        Path part = partFile(uploadId);

        if (Files.size(part) != entity.getTotalSize()) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Upload incomplete: size mismatch");
        }
        if (entity.getChecksum() != null && !entity.getChecksum().isBlank()) {
            String actual = FileIdentityUtils.fullHash(part);
            if (actual == null || !actual.equalsIgnoreCase(entity.getChecksum())) {
                throw new DbWorldException(HttpStatus.BAD_REQUEST, "Upload checksum mismatch");
            }
        }

        Path base = locationService.resolveBase(entity.getLocationId());
        Path dest = PathJail.resolve(base, entity.getTargetPath() + "/" + safeName(entity.getFileName()));
        String onConflict = entity.getOnConflict();
        boolean overwrite = false;

        if (Files.exists(dest)) {
            switch (onConflict) {
                case "overwrite" -> overwrite = true;
                case "rename" -> dest = nextAvailableName(dest);
                default -> throw new DbWorldException(HttpStatus.CONFLICT,
                        "A file named '" + dest.getFileName() + "' already exists");
            }
        }

        try {
            if (overwrite) {
                Files.move(part, dest, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            } else {
                Files.move(part, dest, StandardCopyOption.ATOMIC_MOVE);
            }
        } catch (AtomicMoveNotSupportedException e) {
            if (overwrite) {
                Files.move(part, dest, StandardCopyOption.REPLACE_EXISTING);
            } else {
                Files.move(part, dest);
            }
        }

        repo.delete(entity);
        log.info("Upload session completed id={} locationId={} dest={}", uploadId, entity.getLocationId(), dest);
        return FileMetadataMapper.toDto(entity.getLocationId(), base, dest, false);
    }

    public void abort(String uploadId) throws IOException {
        UploadSessionEntity entity = getOrThrow(uploadId);
        Path part = partFile(uploadId);
        try {
            Files.deleteIfExists(part);
        } catch (IOException ex) {
            log.warn("Upload abort: failed to delete part file {}", part, ex);
        }
        repo.delete(entity);
        log.info("Upload session aborted id={}", uploadId);
    }

    private UploadSessionEntity getOrThrow(String uploadId) {
        return repo.findById(uploadId)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "Upload session not found: " + uploadId));
    }

    private Path uploadsDir() {
        return appProperties.getTempPath().resolve("uploads");
    }

    private Path partFile(String uploadId) {
        return uploadsDir().resolve(uploadId + ".part");
    }

    private static String safeName(String name) {
        String n = name == null ? "" : name.replace("\\", "/");
        int idx = n.lastIndexOf('/');
        n = idx >= 0 ? n.substring(idx + 1) : n;
        if (n.isBlank() || n.equals(".") || n.equals("..")) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Invalid file name");
        }
        return n;
    }

    private static Path nextAvailableName(Path dest) {
        Path parent = dest.getParent();
        String name = dest.getFileName().toString();
        String stem = name;
        String ext = "";
        int dot = name.lastIndexOf('.');
        if (dot > 0) {
            stem = name.substring(0, dot);
            ext = name.substring(dot);
        }
        int n = 1;
        Path candidate = dest;
        while (Files.exists(candidate)) {
            candidate = parent.resolve(stem + " (" + n + ")" + ext);
            n++;
        }
        return candidate;
    }

    private static UploadSessionDto toDto(UploadSessionEntity e) {
        return UploadSessionDto.builder()
                .uploadId(e.getId())
                .totalSize(e.getTotalSize())
                .chunkSize(e.getChunkSize())
                .receivedBytes(e.getReceivedBytes())
                .nextIndex(e.getNextIndex())
                .status(e.getStatus())
                .build();
    }
}
