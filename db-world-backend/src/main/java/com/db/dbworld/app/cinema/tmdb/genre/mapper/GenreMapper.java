package com.db.dbworld.app.cinema.tmdb.genre.mapper;

import com.db.dbworld.cinema.tmdb.genre.dto.GenreDto;
import com.db.dbworld.cinema.tmdb.genre.entity.GenreEntity;
import com.db.dbworld.cinema.tmdb.mapper.BaseMapper;
import com.db.dbworld.cinema.tmdb.mapper.BaseMapperConfig;
import org.mapstruct.Mapper;

@Mapper(config = BaseMapperConfig.class)
public interface GenreMapper
        extends BaseMapper<GenreDto, GenreEntity> {
}