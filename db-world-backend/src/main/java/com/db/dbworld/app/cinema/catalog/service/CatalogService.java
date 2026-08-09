package com.db.dbworld.app.cinema.catalog.service;

import com.db.dbworld.app.cinema.catalog.dto.RecordAdminRowDto;
import com.db.dbworld.app.cinema.catalog.dto.RecordDto;
import com.db.dbworld.app.cinema.catalog.dto.SearchRecordDto;
import com.db.dbworld.app.cinema.catalog.dto.request.AddTagRequest;
import com.db.dbworld.app.cinema.catalog.dto.request.CreateRecordRequest;
import com.db.dbworld.app.cinema.catalog.dto.request.UpdateRecordRequest;
import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.enums.RecordVisibility;
import com.db.dbworld.app.cinema.tmdb.enums.SyncStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface CatalogService {

    RecordDto createRecord(CreateRecordRequest request);

    /**
     * Set a record's visibility (DRAFT / PUBLISHED / UNLISTED). Publishing (first transition to
     * PUBLISHED) fires the one-time "new title" push when the record has media files — see
     * {@code announceIfReady}. Publishing without media is allowed (warned in the UI) and simply
     * defers the push until media arrives.
     */
    RecordDto setVisibility(Long recordId, RecordVisibility visibility);

    RecordDto updateRecord(Long id, UpdateRecordRequest request);

    /** Admin-facing read — returns the record regardless of visibility (drafts included). */
    RecordDto getRecord(Long recordId);

    /** Public-facing read — 404s a DRAFT so unpublished records aren't reachable by direct link. */
    RecordDto getPublicRecord(Long recordId);

    /**
     * Hook called after a record's media finishes ingesting: auto-publishes the draft when the
     * {@code cinema.record.auto-publish-on-media} setting is on, and fires the deferred "new title"
     * push if the record is now publicly playable. Best-effort — never throws.
     */
    void onMediaIngested(Long recordId);

    /**
     * Returns up to {@code limit} records sharing the primary genre of
     * {@code recordId}, excluding the source record itself. Used by the detail
     * page's "More Like This" section. Lightweight DTOs only — no nested
     * TMDB collections.
     */
    List<SearchRecordDto> getSimilar(Long recordId, int limit);

    List<RecordDto> getAllRecords();

    Page<RecordAdminRowDto> getAdminTable(
            Long recordId,
            String name,
            RecordType type,
            Long tmdbId,
            Integer year,
            SyncStatus status,
            Pageable pageable
    );

    void deleteRecord(Long recordId);

    RecordDto refreshRecord(Long tmdbId);

    void addTag(Long recordId, AddTagRequest request);

    void removeTag(Long recordId, RecordTagType tagType);

    Optional<RecordEntity> getRecordEntityOptById(Long recordId);
}