package com.db.dbworld.app.media.info.service;

import com.db.dbworld.app.media.info.dto.MediaFileDto;
import com.db.dbworld.app.media.info.dto.MediaFileStatsDto;
import com.db.dbworld.app.media.info.dto.MediaFileSummaryDto;
import com.db.dbworld.app.media.info.entity.MediaFileEntity;
import org.springframework.data.domain.Page;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

/**
 * Service for collecting, parsing, and persisting MediaInfo metadata.
 *
 * Replaces the old MediaFileInfoService (services.media).
 * Uses com.db.dbworld.app.cinema RecordEntity instead of DBCinemaRecordsEntity.
 *
 * Flow:
 *   1. Run `mediainfo --output=JSON <path>` via ProcessExecutor
 *   2. Parse JSON → MediaFileEntity + TrackEntity subclasses
 *   3. Persist to media_files / media_tracks tables
 *   4. Return DTO
 */
public interface MediaInfoService {

    /**
     * Run mediainfo on a file, parse, and persist. Returns the saved DTO.
     *
     * @param filePath      absolute path to the media file
     * @param recordId      optional cinema record ID to link
     * @param ingestionJobId optional ingestion job ID for traceability
     */
    MediaFileDto collectAndPersist(Path filePath, Long recordId, String ingestionJobId);

    /**
     * Re-scan an existing entry (file may have changed or been replaced).
     * Deletes old track data and re-inserts.
     */
    MediaFileDto rescan(String mediaFileId);

    /** Get all media files for a cinema record. */
    List<MediaFileDto> getByRecordId(Long recordId);

    /** Get a single media file entry. */
    Optional<MediaFileDto> getById(String id);

    /** Get by absolute file path. */
    Optional<MediaFileDto> getByFilePath(String filePath);

    /** Delete all metadata for a file path. */
    void deleteByFilePath(String filePath);

    /** Delete all metadata linked to a record. */
    void deleteByRecordId(Long recordId);

    /**
     * Run mediainfo and return the raw JSON string without persisting.
     * Useful for quick inspection or pre-persistence validation.
     */
    String getRawJson(Path filePath);

    /**
     * Returns all persisted media file entries.
     * Used by {@code SymlinkService.ensureAll()} for bulk symlink repair.
     */
    List<MediaFileDto> findAll();

    /** Paginated summary list — no rawMediaInfo, fast. */
    Page<MediaFileSummaryDto> getPagedSummary(String q, Boolean linked, String sort, int page, int size);

    /** Aggregate stats — counts and sizes only, no track data loaded. */
    MediaFileStatsDto getStats();

    @Transactional(readOnly = true)
    MediaFileDto collectMediaInfo(Path filePath);

    /** Convert an entity to DTO (exposed for controller use). */
    MediaFileDto toDto(MediaFileEntity entity);

    /** Set (or clear) the TMDB season/episode numbers for a media file. */
    MediaFileDto updateEpisodeNumbers(String id, Integer season, Integer episode);

    /**
     * (Re)generate the scrub-preview storyboard sprite for a media file on demand.
     * Validates the file/duration on the calling thread, then runs the (slow,
     * ffmpeg-heavy) generation asynchronously so the HTTP request returns promptly.
     *
     * @throws IllegalArgumentException when no media file has the given id
     * @throws IllegalStateException    when the source file is missing or its duration is unknown
     */
    void generateStoryboard(String mediaFileId);
}
