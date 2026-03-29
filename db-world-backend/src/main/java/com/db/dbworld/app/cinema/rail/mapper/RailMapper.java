package com.db.dbworld.app.cinema.rail.mapper;

import com.db.dbworld.app.cinema.rail.dto.RailDto;
import com.db.dbworld.app.cinema.rail.dto.RailRequest;
import com.db.dbworld.app.cinema.rail.entity.RailEntity;
import org.mapstruct.*;

@Mapper(componentModel = "spring")
public interface RailMapper {

    /* =========================================
       CREATE ENTITY
       ========================================= */

    RailEntity toEntity(RailRequest request);

    /* =========================================
       ENTITY → DTO
       records are populated separately
       ========================================= */

    @Mapping(target = "records", ignore = true)
    RailDto toDto(RailEntity entity);

    /* =========================================
       UPDATE EXISTING ENTITY
       Ignore null values from request
       ========================================= */

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void updateEntity(RailRequest request, @MappingTarget RailEntity entity);
}