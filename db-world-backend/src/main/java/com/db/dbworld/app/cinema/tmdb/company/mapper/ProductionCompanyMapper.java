package com.db.dbworld.app.cinema.tmdb.company.mapper;

import com.db.dbworld.cinema.tmdb.company.dto.ProductionCompanyDto;
import com.db.dbworld.cinema.tmdb.company.entity.ProductionCompanyEntity;
import com.db.dbworld.cinema.tmdb.client.dto.ProductionCompanyTmdbResponse;
import com.db.dbworld.cinema.tmdb.mapper.BaseMapper;
import com.db.dbworld.cinema.tmdb.mapper.BaseMapperConfig;

import org.mapstruct.InheritInverseConfiguration;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(config = BaseMapperConfig.class)
public interface ProductionCompanyMapper
        extends BaseMapper<ProductionCompanyDto, ProductionCompanyEntity> {

    /* ================================
       DTO → ENTITY
     ================================ */

    @Override
    ProductionCompanyEntity toEntity(ProductionCompanyDto dto);

    /* ================================
       ENTITY → DTO
     ================================ */

    @Override
    @InheritInverseConfiguration
    ProductionCompanyDto toDto(ProductionCompanyEntity entity);

    /* ================================
       TMDB RESPONSE → ENTITY
     ================================ */

    @Mapping(source = "logo_path", target = "logoPath")
    @Mapping(source = "origin_country", target = "originCountry")
    ProductionCompanyEntity fromTmdb(ProductionCompanyTmdbResponse response);

    default List<ProductionCompanyEntity> fromTmdbList(List<ProductionCompanyTmdbResponse> list) {
        if (list == null) return null;
        return list.stream().map(this::fromTmdb).toList();
    }

}