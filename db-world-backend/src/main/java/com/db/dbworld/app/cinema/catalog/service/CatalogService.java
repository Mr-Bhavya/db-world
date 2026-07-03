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
import com.db.dbworld.app.cinema.tmdb.enums.SyncStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface CatalogService {

    RecordDto createRecord(CreateRecordRequest request);

    /** Toggle whether a record is hidden from rails (search visibility unchanged). */
    RecordDto setHideFromRails(Long recordId, boolean hide);

    RecordDto updateRecord(Long id, UpdateRecordRequest request);

    RecordDto getRecord(Long recordId);

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