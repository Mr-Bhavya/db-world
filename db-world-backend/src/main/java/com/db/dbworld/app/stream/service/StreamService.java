package com.db.dbworld.app.stream.service;

import com.db.dbworld.helpers.DbWorldRecords;
import org.springframework.http.ResponseEntity;

import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

/**
 * Service for media file streaming and discovery.
 * Migrated from com.db.dbworld.services.media.StreamService.
 *
 * Media-info methods (getMediaInfoByFileId, parseMediaInfo) removed — use
 * {@link com.db.dbworld.app.media.info.service.MediaInfoService} instead.
 */
public interface StreamService {

    /* ========================= STREAMING ========================= */

    /**
     * Stream a media file via CDN using a resolved filesystem or symlink path.
     * Intended for internal usage where the path is already trusted.
     */
    ResponseEntity<Void> streamByPath(String user, Path path, String rangeHeader, boolean inline);

    /**
     * Stream a media file via CDN using a media file ID.
     * This is the primary method for controllers and public APIs.
     */
    ResponseEntity<Void> streamById(String user, String mediaFileId, String rangeHeader, boolean inline);

    /* ========================= DISCOVERY ========================= */

    /**
     * Recursively list streamable files under a directory.
     */
    List<DbWorldRecords.StreamableFileInfo> listRecursive(Path dir);

    /**
     * List all streamable files from all configured media roots.
     */
    List<DbWorldRecords.StreamableFileInfo> listAllStreamable();

    /**
     * Check whether a file name matches a user query.
     */
    boolean matchesQuery(String fileName, String query);

    /**
     * Resolve a file path by its generated file ID.
     * Used mainly for backward compatibility and diagnostics.
     */
    Optional<Path> resolvePathByFileId(String fileId);

    /**
     * Build streamable metadata for a single file.
     */
    DbWorldRecords.StreamableFileInfo buildDetails(Path path);
}
