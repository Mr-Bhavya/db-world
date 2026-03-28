package com.db.dbworld.app.cinema.catalog.mapper;

import com.db.dbworld.cinema.catalog.dto.RecordDto;
import com.db.dbworld.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.cinema.tmdb.mapper.BaseMapper;
import com.db.dbworld.cinema.tmdb.mapper.BaseMapperConfig;
import com.db.dbworld.cinema.tmdb.mapper.TmdbMapper;
import org.mapstruct.*;

@Mapper(
        config = BaseMapperConfig.class,
        uses = {
                RecordTagMapper.class,
                TmdbMapper.class
        }
)
public interface RecordMapper extends BaseMapper<RecordDto, RecordEntity> {

    @Override
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    RecordEntity toEntity(RecordDto dto);

    @Override
    RecordDto toDto(RecordEntity entity);
}