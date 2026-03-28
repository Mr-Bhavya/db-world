package com.db.dbworld.app.cinema.tmdb.review.mapper;

import com.db.dbworld.cinema.tmdb.client.dto.*;
import com.db.dbworld.cinema.tmdb.review.dto.ReviewDto;
import com.db.dbworld.cinema.tmdb.review.entity.ReviewEntity;
import com.db.dbworld.cinema.tmdb.mapper.BaseMapperConfig;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.time.Instant;
import java.util.ArrayList;
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
       TMDB → ENTITY
     ===================================== */

    @Mapping(source = "author_details", target = "authorDetails")
    @Mapping(source = "created_at", target = "createdAt")
    @Mapping(source = "updated_at", target = "updatedAt")
    @Mapping(target = "tmdb", ignore = true)
    ReviewEntity fromTmdb(ReviewTmdbResponse response);

    /* =====================================
       PAGE → ENTITY LIST
     ===================================== */

    default List<ReviewEntity> fromTmdb(ReviewPageTmdbResponse page) {

        if (page == null || page.getResults() == null) {
            return List.of();
        }

        List<ReviewEntity> reviews = new ArrayList<>();

        page.getResults()
                .forEach(r -> reviews.add(fromTmdb(r)));

        return reviews;
    }

    /* =====================================
       MULTI PAGE → ENTITY LIST
     ===================================== */

    default List<ReviewEntity> fromPages(List<ReviewPageTmdbResponse> pages) {

        if (pages == null) return List.of();

        List<ReviewEntity> reviews = new ArrayList<>();

        for (ReviewPageTmdbResponse page : pages) {
            reviews.addAll(fromTmdb(page));
        }

        return reviews;
    }

    /* =====================================
       STRING → INSTANT
     ===================================== */

    default Instant map(String date) {

        if (date == null || date.isBlank()) {
            return null;
        }

        return Instant.parse(date);
    }
}