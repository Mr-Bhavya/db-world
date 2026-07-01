package com.db.dbworld.app.media.delete;

import com.db.dbworld.app.media.info.dto.MediaFileDto;
import com.db.dbworld.app.media.info.service.MediaInfoService;
import com.db.dbworld.app.media.link.SymlinkService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Single entry point for deleting a media file across all of its artefacts:
 * the physical file on disk, the CDN symlink, the DB row (+ tracks, cascade),
 * and — via the JPA {@code @PostRemove} hook on the row — its storyboard sprite.
 *
 * The operation cannot be atomic (filesystem + DB span two worlds), so it is
 * deliberately <b>best-effort + transactional-DB + idempotent</b>:
 * <ul>
 *   <li>the filesystem steps (file, symlink) never throw — a failure is captured
 *       as a warning and the delete continues;</li>
 *   <li>the DB row removal is the single transactional, authoritative step;</li>
 *   <li>re-running the delete (or the reconciliation scan / cleanup endpoint)
 *       reconciles any orphan a partial failure left behind.</li>
 * </ul>
 *
 * The physical file is removed <b>first</b> so that once the DB row is gone there
 * is no on-disk file for the reconciliation scan to resurrect as an unassigned
 * file. Every step's outcome is returned so callers can report it honestly.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class MediaFileDeletionService {

    private final MediaInfoService mediaInfoService;
    private final SymlinkService   symlinkService;

    /**
     * @param deletePhysicalFile true to also erase the file from disk (permanent
     *                           delete); false to keep the file (remove-from-library).
     */
    public MediaFileDeleteResult deleteById(String id, boolean deletePhysicalFile) {
        MediaFileDto dto = mediaInfoService.getById(id).orElse(null);
        if (dto == null) {
            log.info("Media file delete: id={} not found (nothing to do)", id);
            return MediaFileDeleteResult.notFound(id);
        }

        String filePath = dto.getFilePath();
        List<String> warnings = new ArrayList<>();

        // 1. Physical file (best-effort, first — see class doc).
        Boolean physicalDeleted = null;
        if (deletePhysicalFile) {
            physicalDeleted = false;
            if (filePath == null || filePath.isBlank()) {
                warnings.add("No file path on record — nothing to delete from disk");
            } else {
                try {
                    physicalDeleted = Files.deleteIfExists(Path.of(filePath));
                    if (!physicalDeleted) warnings.add("File was already gone from disk");
                } catch (Exception e) {
                    warnings.add("Could not delete file from disk: " + e.getMessage());
                    log.warn("Media file delete: file removal failed id={} path={}: {}", id, filePath, e.getMessage());
                }
            }
        }

        // 2. CDN symlink (best-effort).
        boolean symlinkRemoved = symlinkService.deleteById(id);

        // 3. DB row + tracks (transactional) → storyboard sprite via @PostRemove.
        boolean dbDeleted = false;
        try {
            mediaInfoService.deleteByFilePath(filePath);
            dbDeleted = true;
        } catch (Exception e) {
            warnings.add("Could not delete database record: " + e.getMessage());
            log.warn("Media file delete: DB removal failed id={} path={}: {}", id, filePath, e.getMessage());
        }

        log.info("Media file delete id={} → fileDeleted={}, symlinkRemoved={}, dbDeleted={}, warnings={}",
                id, physicalDeleted, symlinkRemoved, dbDeleted, warnings.size());
        return new MediaFileDeleteResult(id, filePath, physicalDeleted, symlinkRemoved, dbDeleted, true, warnings);
    }
}
