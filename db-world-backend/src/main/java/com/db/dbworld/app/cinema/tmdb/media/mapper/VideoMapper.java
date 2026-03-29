package com.db.dbworld.app.cinema.tmdb.media.mapper;

import com.db.dbworld.app.cinema.tmdb.client.dto.VideoTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.client.dto.VideosTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.media.dto.VideoDto;
import com.db.dbworld.app.cinema.tmdb.media.entity.VideoEntity;
import com.db.dbworld.app.cinema.tmdb.mapper.BaseMapper;
import com.db.dbworld.app.cinema.tmdb.mapper.BaseMapperConfig;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(config = BaseMapperConfig.class)
public interface VideoMapper extends BaseMapper<VideoDto, VideoEntity> {

    /* =====================================
       DTO ↔ ENTITY
     ===================================== */

    @Override
    VideoEntity toEntity(VideoDto dto);

    @Override
    VideoDto toDto(VideoEntity entity);

    /* =====================================
       TMDB RESPONSE → ENTITY
     ===================================== */

    @Mapping(source = "published_at", target = "publishedAt")
    @Mapping(source = "iso_639_1", target = "iso6391")
    @Mapping(source = "iso_3166_1", target = "iso31661")
    VideoEntity fromTmdb(VideoTmdbResponse response);

    /* =====================================
       WRAPPER RESPONSE → LIST
     ===================================== */

    default List<VideoEntity> fromTmdb(VideosTmdbResponse response) {

        if (response == null || response.getResults() == null) {
            return List.of();
        }

        return response.getResults()
                .stream()
                .map(this::fromTmdb)
                .toList();
    }

}