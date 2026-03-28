package com.db.dbworld.app.cinema.tmdb.language.mapper;

import com.db.dbworld.cinema.tmdb.client.dto.SpokenLanguageTmdbResponse;
import com.db.dbworld.cinema.tmdb.language.dto.SpokenLanguageDto;
import com.db.dbworld.cinema.tmdb.language.entity.SpokenLanguageEntity;
import com.db.dbworld.cinema.tmdb.mapper.BaseMapper;
import com.db.dbworld.cinema.tmdb.mapper.BaseMapperConfig;
import org.mapstruct.InheritInverseConfiguration;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(config = BaseMapperConfig.class)
public interface SpokenLanguageMapper
        extends BaseMapper<SpokenLanguageDto, SpokenLanguageEntity> {

    @Override
    SpokenLanguageEntity toEntity(SpokenLanguageDto dto);

    @Override
    SpokenLanguageDto toDto(SpokenLanguageEntity entity);

    @Mapping(source = "iso_639_1", target = "isoCode")
    @Mapping(source = "english_name", target = "englishName")
    @Mapping(source = "name", target = "name")
    SpokenLanguageEntity fromTmdb(SpokenLanguageTmdbResponse response);

    default List<SpokenLanguageEntity> fromTmdbList(List<SpokenLanguageTmdbResponse> list) {
        if (list == null) return null;
        return list.stream().map(this::fromTmdb).toList();
    }

}