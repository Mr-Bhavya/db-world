package com.db.dbworld.app.media.link;

import com.db.dbworld.app.media.info.entity.MediaFileEntity;
import com.db.dbworld.app.media.info.repository.MediaFileRepository;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.utils.DbWorldRuntimeProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

/**
 * Manages OS-level symbolic links for media files.
 *
 * Each media file in the DB gets a symlink at:
 *   {@code <symlinkRoot>/<mediaFileId>} → relative path to the real file
 *
 * This lets the streaming layer resolve any file by a stable UUID regardless
 * of where the file is stored on disk.
 *
 * Replaces {@code services.media.SystemLinkService}.
 * Key improvements:
 * <ul>
 *   <li>Uses new {@code MediaFileEntity} / {@code MediaFileRepository} from
 *       {@code app.media.info} (removes dependency on old entities package)</li>
 *   <li>Constructor injection via {@code @RequiredArgsConstructor}</li>
 *   <li>ID + path overload avoids unnecessary entity hydration in hot paths</li>
 * </ul>
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class SymlinkService {

    private static final String TAG = "[SYMLINK]";

    private final DbWorldRuntimeProperties runtimeProperties;
    private final MediaFileRepository      mediaFileRepository;

    // ──────────────────────────────────────────────────────────────────────────
    // CREATE
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Creates (or replaces) the symlink for the given media file ID and path.
     * Preferred hot-path overload — no DB round-trip.
     */
    public void create(String fileId, String filePath) {
        if (fileId == null || filePath == null) {
            throw new DbWorldException("Invalid arguments for symlink creation");
        }
        try {
            Path symlinkRoot = runtimeProperties.getSymlinkPath();
            Path realFile    = Path.of(filePath);
            Path symlink     = symlinkRoot.resolve(fileId);

            Files.createDirectories(symlinkRoot);

            if (Files.exists(symlink, LinkOption.NOFOLLOW_LINKS)) {
                Files.delete(symlink);
            }

            // Use a relative target so the symlink survives directory moves
            Path relativeTarget = symlinkRoot.relativize(realFile);
            Files.createSymbolicLink(symlink, relativeTarget);

            log.debug("{} Created {} -> {}", TAG, symlink, relativeTarget);

        } catch (Exception ex) {
            log.error("{} Failed to create symlink for fileId={}", TAG, fileId, ex);
            throw new DbWorldException("Failed to create system symlink", ex);
        }
    }

    /** Entity-based convenience overload. */
    public void create(MediaFileEntity entity) {
        if (entity == null || entity.getId() == null || entity.getFilePath() == null) {
            throw new DbWorldException("Invalid media entity for symlink creation");
        }
        create(entity.getId(), entity.getFilePath());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // DELETE
    // ──────────────────────────────────────────────────────────────────────────

    public void deleteById(String fileId) {
        try {
            Path symlink = runtimeProperties.getSymlinkPath().resolve(fileId);
            if (Files.exists(symlink, LinkOption.NOFOLLOW_LINKS)) {
                Files.delete(symlink);
                log.info("{} Deleted {}", TAG, symlink);
            }
        } catch (Exception ex) {
            log.warn("{} Failed to delete symlink for fileId={}", TAG, fileId, ex);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // VALIDATION
    // ──────────────────────────────────────────────────────────────────────────

    public boolean isValid(String fileId) {
        try {
            Path symlink = runtimeProperties.getSymlinkPath().resolve(fileId);
            return Files.exists(symlink, LinkOption.NOFOLLOW_LINKS)
                    && Files.exists(symlink.toRealPath());
        } catch (Exception ex) {
            return false;
        }
    }

    /**
     * Creates the symlink if it does not already exist or is broken.
     *
     * @return {@code true} if the symlink was (re)created
     */
    public boolean ensure(MediaFileEntity entity) {
        if (!isValid(entity.getId())) {
            create(entity);
            return true;
        }
        return false;
    }

    /** ID + path overload — avoids entity construction in watcher hot path. */
    public boolean ensure(String fileId, String filePath) {
        if (!isValid(fileId)) {
            create(fileId, filePath);
            return true;
        }
        return false;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // SINGLE-ID REPAIR
    // ──────────────────────────────────────────────────────────────────────────

    public ResponsePayloads.SymlinkRepairSingleResult ensureOne(String fileId, boolean dryRun) {
        try {
            Path symlink = runtimeProperties.getSymlinkPath().resolve(fileId);
            MediaFileEntity entity = mediaFileRepository.findById(fileId).orElse(null);

            if (entity != null && entity.getFilePath() != null) {
                if (isValid(fileId)) {
                    return ResponsePayloads.SymlinkRepairSingleResult.builder()
                            .fileId(fileId).skipped(true).message("Symlink already valid").build();
                }
                if (!dryRun) create(entity);
                return ResponsePayloads.SymlinkRepairSingleResult.builder()
                        .fileId(fileId).created(true)
                        .message(dryRun ? "Symlink would be created" : "Symlink created").build();
            }

            if (Files.exists(symlink, LinkOption.NOFOLLOW_LINKS)) {
                if (!dryRun) Files.delete(symlink);
                return ResponsePayloads.SymlinkRepairSingleResult.builder()
                        .fileId(fileId).deleted(true)
                        .message(dryRun ? "Orphan symlink would be deleted" : "Orphan symlink deleted").build();
            }

            return ResponsePayloads.SymlinkRepairSingleResult.builder()
                    .fileId(fileId).skipped(true).message("Nothing to repair").build();

        } catch (Exception ex) {
            log.warn("{} Single repair failed for fileId={}", TAG, fileId, ex);
            return ResponsePayloads.SymlinkRepairSingleResult.builder()
                    .fileId(fileId).failed(true).message("Repair failed: " + ex.getMessage()).build();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // BULK REPAIR
    // ──────────────────────────────────────────────────────────────────────────

    public ResponsePayloads.SymlinkRepairResult ensureAll(boolean dryRun) {
        int repaired = 0;
        int skipped  = 0;
        AtomicInteger deleted = new AtomicInteger();
        AtomicInteger failed  = new AtomicInteger();

        Path symlinkRoot = runtimeProperties.getSymlinkPath();
        List<MediaFileEntity> entities = mediaFileRepository.findAll();

        // Collect all known IDs for orphan-detection pass
        Set<String> dbIds = new HashSet<>(entities.size() * 2);
        for (MediaFileEntity e : entities) {
            if (e.getId() != null) dbIds.add(e.getId());
        }

        // DB → symlink: create / repair missing links
        for (MediaFileEntity entity : entities) {
            try {
                if (entity.getId() == null || entity.getFilePath() == null) { skipped++; continue; }
                if (!isValid(entity.getId())) {
                    if (!dryRun) create(entity);
                    repaired++;
                }
            } catch (Exception ex) {
                failed.incrementAndGet();
                log.warn("{} Repair failed for fileId={}", TAG, entity.getId(), ex);
            }
        }

        // Symlink dir → DB: remove orphans
        if (Files.exists(symlinkRoot)) {
            try (Stream<Path> paths = Files.list(symlinkRoot)) {
                paths.filter(Files::isSymbolicLink).forEach(path -> {
                    try {
                        String fileId = path.getFileName().toString();
                        if (!dbIds.contains(fileId)) {
                            if (!dryRun) Files.delete(path);
                            deleted.incrementAndGet();
                            log.info("{} Removed orphan symlink {}", TAG, path);
                        }
                    } catch (Exception ex) {
                        failed.incrementAndGet();
                        log.warn("{} Failed to remove orphan {}", TAG, path, ex);
                    }
                });
            } catch (Exception ex) {
                log.error("{} Failed to scan symlink directory", TAG, ex);
            }
        }

        return ResponsePayloads.SymlinkRepairResult.builder()
                .total(entities.size()).repaired(repaired).deleted(deleted.get())
                .skipped(skipped).failed(failed.get()).dryRun(dryRun).build();
    }
}
