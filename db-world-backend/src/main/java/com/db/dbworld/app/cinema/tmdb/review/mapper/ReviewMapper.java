package com.db.dbworld.app.cinema.tmdb.review.mapper;

import com.db.dbworld.app.cinema.tmdb.client.dto.ReviewTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.review.dto.ReviewDto;
import com.db.dbworld.app.cinema.tmdb.review.entity.ReviewEntity;
import com.db.dbworld.app.cinema.tmdb.mapper.BaseMapperConfig;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.List;

@Mapper(
        config = BaseMapperConfig.class,
        uses = { AuthorDetailsMapper.class }
)
public interface ReviewMapper {

    /* =====================================
       DTO → ENTITY
     ===================================== */

    @Mapping(target = "tmdb", ignore = true)
    ReviewEntity toEntity(ReviewDto dto);

    /* =====================================
       ENTITY → DTO
     ===================================== */

    ReviewDto toDto(ReviewEntity entity);

    /* =====================================
       TMDB → ENTITY (SINGLE)
     ===================================== */

    @Mapping(source = "author_details", target = "authorDetails")
    @Mapping(source = "created_at", target = "createdAt")
    @Mapping(source = "updated_at", target = "updatedAt")
    @Mapping(target = "tmdb", ignore = true)
    ReviewEntity fromTmdb(ReviewTmdbResponse response);

    /* =====================================
       TMDB → ENTITY (BATCH) ✅ NEW
     ===================================== */

    List<ReviewEntity> fromTmdbList(List<ReviewTmdbResponse> responses);

    /* =====================================
       STRING → INSTANT
     ===================================== */

    default Instant map(String date) {
        if (date == null || date.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(date);
        } catch (DateTimeParseException e) {
            // TMDB sometimes returns "2024-05-21 08:02:52 UTC" instead of ISO-8601
            String normalized = date.trim().replace(" UTC", "Z").replace(" ", "T");
            return Instant.parse(normalized);
        }
    }
}