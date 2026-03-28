package com.db.dbworld.app.cinema.catalog.controllers;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.cinema.catalog.dto.RecordTagDto;
import com.db.dbworld.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.cinema.catalog.entities.RecordTagEntity;
import com.db.dbworld.cinema.catalog.mapper.RecordTagMapper;
import com.db.dbworld.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.cinema.catalog.repository.RecordTagRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cinema/admin/catalog/tags")
@RequiredArgsConstructor
public class RecordTagController {

    private final RecordTagRepository tagRepository;
    private final RecordRepository recordRepository;
    private final RecordTagMapper tagMapper;

    /* =========================
       ADD TAG
       ========================= */

    @PostMapping("/{recordId}")
    public ApiResponse<RecordTagDto> addTag(
            @PathVariable Long recordId,
            @RequestBody RecordTagDto dto
    ) {
        RecordEntity record =
                recordRepository.findById(recordId)
                        .orElseThrow(() ->
                                new EntityNotFoundException("Record not found"));

        RecordTagEntity entity = tagMapper.toEntity(dto);
        entity.setRecord(record);

        entity = tagRepository.save(entity);

        return ApiResponse.success(tagMapper.toDto(entity));
    }

    /* =========================
       UPDATE TAG
       ========================= */

    @PutMapping("/{tagId}")
    public ApiResponse<RecordTagDto> updateTag(
            @PathVariable Long tagId,
            @RequestBody RecordTagDto dto
    ) {
        RecordTagEntity tag =
                tagRepository.findById(tagId)
                        .orElseThrow(() ->
                                new EntityNotFoundException("Tag not found"));

        tag.setPriority(dto.getPriority());

        tagRepository.save(tag);

        return ApiResponse.success(tagMapper.toDto(tag));
    }

    /* =========================
       DELETE TAG
       ========================= */

    @DeleteMapping("/{tagId}")
    public ApiResponse<Void> deleteTag(@PathVariable Long tagId) {

        tagRepository.deleteById(tagId);

        return ApiResponse.success("Tag removed");
    }
}