package com.db.dbworld.app.stream.service;

import com.db.dbworld.app.stream.dto.CdnResolveDto;
import com.db.dbworld.helpers.DbWorldRecords;
import java.nio.file.Path;
import java.util.List;

/**
 * Service for media file streaming and discovery.
 * Migrated from com.db.dbworld.services.media.StreamService.
 *
 * Media-info methods (getMediaInfoByFileId, parseMediaInfo) removed — use
 * {@link com.db.dbworld.app.media.info.service.MediaInfoService} instead.
 */
public interface StreamService {

    /* ========================= RESOLVE (CDN URL as JSON) ========================= */

    /**
     * Resolve a record-linked media file by UUID and return its CDN URL + metadata.
     * The returned URL can be embedded directly in a video player or download link.
     *
     * @param user        authenticated user email
     * @param mediaFileId UUID of the MediaFileEntity (= symlink filename)
     * @param inline      {@code true} → ONLINE (stream); {@code false} → DOWNLOAD
     * @param userAgent   caller's User-Agent (for activity tracking)
     * @param remoteAddr  caller's IP (for activity tracking)
     */
    CdnResolveDto resolveById(String user, String mediaFileId, boolean inline,
                               String userAgent, String remoteAddr);

    /**
     * Resolve an unassigned media file by its path relative to the stream root
     * and return its CDN URL + metadata (enriched from DB if a MediaFileEntity exists).
     *
     * @param user         authenticated user email
     * @param relativePath path relative to the stream root (as returned in search results)
     * @param inline       {@code true} → ONLINE (stream); {@code false} → DOWNLOAD
     * @param userAgent    caller's User-Agent (for activity tracking)
     * @param remoteAddr   caller's IP (for activity tracking)
     */
    CdnResolveDto resolveByPath(String user, String relativePath, boolean inline,
                                 String userAgent, String remoteAddr);

    /* ========================= DISCOVERY ========================= */

    List<DbWorldRecords.StreamableFileInfo> listRecursive(Path dir);

    List<DbWorldRecords.StreamableFileInfo> listAllStreamable();

    boolean matchesQuery(String fileName, String query);

    DbWorldRecords.StreamableFileInfo buildDetails(Path path);
}
