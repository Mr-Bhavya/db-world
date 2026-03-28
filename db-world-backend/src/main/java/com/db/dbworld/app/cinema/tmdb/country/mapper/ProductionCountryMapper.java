package com.db.dbworld.app.cinema.tmdb.country.mapper;

import com.db.dbworld.cinema.tmdb.client.dto.ProductionCountryTmdbResponse;
import com.db.dbworld.cinema.tmdb.country.dto.ProductionCountryDto;
import com.db.dbworld.cinema.tmdb.country.entity.ProductionCountryEntity;
import com.db.dbworld.cinema.tmdb.mapper.BaseMapper;
import com.db.dbworld.cinema.tmdb.mapper.BaseMapperConfig;

import org.mapstruct.InheritInverseConfiguration;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(config = BaseMapperConfig.class)
public interface ProductionCountryMapper
        extends BaseMapper<ProductionCountryDto, ProductionCountryEntity> {

    /* ================================
       DTO → ENTITY
     ================================ */

    @Override
    ProductionCountryEntity toEntity(ProductionCountryDto dto);

    /* ================================
       ENTITY → DTO
     ================================ */

    @Override
    ProductionCountryDto toDto(ProductionCountryEntity entity);

    /* ================================
       TMDB RESPONSE → ENTITY
     ================================ */

    @Mapping(source = "iso_3166_1", target = "isoCode")
    @Mapping(source = "english_name", target = "englishName")
    @Mapping(source = "name", target = "nativeName")
    ProductionCountryEntity fromTmdb(ProductionCountryTmdbResponse response);

    default List<ProductionCountryEntity> fromTmdbList(List<ProductionCountryTmdbResponse> list) {
        if (list == null) return null;
        return list.stream().map(this::fromTmdb).toList();
    }

}