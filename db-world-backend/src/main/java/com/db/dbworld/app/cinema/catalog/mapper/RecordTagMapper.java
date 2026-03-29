package com.db.dbworld.app.cinema.catalog.mapper;

import com.db.dbworld.app.cinema.catalog.dto.RecordTagDto;
import com.db.dbworld.app.cinema.catalog.entities.RecordTagEntity;
import com.db.dbworld.app.cinema.tmdb.mapper.BaseMapper;
import com.db.dbworld.app.cinema.tmdb.mapper.BaseMapperConfig;
import org.mapstruct.*;

@Mapper(config = BaseMapperConfig.class)
public interface RecordTagMapper
        extends BaseMapper<RecordTagDto, RecordTagEntity> {

    @Override
    @Mapping(target = "record", ignore = true)
    RecordTagEntity toEntity(RecordTagDto dto);

    @Override
    @Mapping(source = "record.id", target = "recordId")
    RecordTagDto toDto(RecordTagEntity entity);
}