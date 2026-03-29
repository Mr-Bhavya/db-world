package com.db.dbworld.app.cinema.catalog.service;

import com.db.dbworld.app.cinema.catalog.dto.RecordAdminRowDto;
import com.db.dbworld.app.cinema.catalog.dto.RecordDto;
import com.db.dbworld.app.cinema.catalog.dto.request.AddTagRequest;
import com.db.dbworld.app.cinema.catalog.dto.request.CreateRecordRequest;
import com.db.dbworld.app.cinema.catalog.dto.request.UpdateRecordRequest;
import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import com.db.dbworld.app.cinema.enums.RecordType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface CatalogService {

    RecordDto createRecord(CreateRecordRequest request);

    RecordDto updateRecord(Long id, UpdateRecordRequest request);

    RecordDto getRecord(Long recordId);

    List<RecordDto> getAllRecords();

    Page<RecordAdminRowDto> getAdminTable(
            Long recordId,
            String name,
            RecordType type,
            Long tmdbId,
            Integer year,
            Pageable pageable
    );

    void deleteRecord(Long recordId);

    RecordDto refreshRecord(Long tmdbId);

    void addTag(Long recordId, AddTagRequest request);

    void removeTag(Long recordId, RecordTagType tagType);

    Optional<RecordEntity> getRecordEntityOptById(Long recordId);
}