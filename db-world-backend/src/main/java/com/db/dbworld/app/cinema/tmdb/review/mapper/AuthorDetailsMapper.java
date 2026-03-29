package com.db.dbworld.app.cinema.tmdb.review.mapper;

import com.db.dbworld.app.cinema.tmdb.client.dto.AuthorDetailsTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.review.dto.AuthorDetailsDto;
import com.db.dbworld.app.cinema.tmdb.review.entity.AuthorDetails;
import com.db.dbworld.app.cinema.tmdb.mapper.BaseMapperConfig;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(config = BaseMapperConfig.class)
public interface AuthorDetailsMapper {

    /* DTO → ENTITY */

    AuthorDetails toEntity(AuthorDetailsDto dto);

    /* ENTITY → DTO */

    AuthorDetailsDto toDto(AuthorDetails entity);

    /* TMDB → ENTITY */

    @Mapping(source = "avatar_path", target = "avatarPath")
    AuthorDetails fromTmdb(AuthorDetailsTmdbResponse response);
}