package com.db.dbworld.app.cinema.tmdb.collection.mapper;

import com.db.dbworld.cinema.tmdb.collection.dto.CollectionDto;
import com.db.dbworld.cinema.tmdb.collection.entity.CollectionEntity;
import com.db.dbworld.cinema.tmdb.client.dto.CollectionTmdbResponse;
import com.db.dbworld.cinema.tmdb.mapper.BaseMapper;
import com.db.dbworld.cinema.tmdb.mapper.BaseMapperConfig;

import org.mapstruct.InheritInverseConfiguration;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(config = BaseMapperConfig.class)
public interface CollectionMapper extends BaseMapper<CollectionDto, CollectionEntity> {

    /* ===============================
       DTO → ENTITY
     =============================== */

    @Override
    CollectionEntity toEntity(CollectionDto dto);

    /* ===============================
       ENTITY → DTO
     =============================== */

    @Override
    CollectionDto toDto(CollectionEntity entity);

    /* ===============================
       TMDB RESPONSE → ENTITY
     =============================== */

    @Mapping(source = "poster_path", target = "posterPath")
    @Mapping(source = "backdrop_path", target = "backdropPath")
    CollectionEntity fromTmdb(CollectionTmdbResponse response);

}