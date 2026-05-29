package com.db.dbworld.app.cinema.rail.mapper;

import com.db.dbworld.app.cinema.rail.dto.RailDto;
import com.db.dbworld.app.cinema.rail.dto.RailRequest;
import com.db.dbworld.app.cinema.rail.entity.RailEntity;
import org.mapstruct.*;

// unmappedTargetPolicy=IGNORE — `id` is DB-generated and never set from
// requests; the noisy "Unmapped target property: id" warning added no value.
@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
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