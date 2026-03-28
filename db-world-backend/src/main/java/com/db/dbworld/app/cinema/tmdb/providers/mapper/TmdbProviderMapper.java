package com.db.dbworld.app.cinema.tmdb.providers.mapper;

import com.db.dbworld.cinema.tmdb.mapper.BaseMapper;
import com.db.dbworld.cinema.tmdb.mapper.BaseMapperConfig;
import com.db.dbworld.cinema.tmdb.providers.dto.ProviderDto;
import com.db.dbworld.cinema.tmdb.providers.dto.ProviderProjection;
import com.db.dbworld.cinema.tmdb.providers.dto.TmdbProviderDto;
import com.db.dbworld.cinema.tmdb.providers.entity.TmdbProviderEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;
import java.util.Set;

@Mapper(config = BaseMapperConfig.class, uses = {ProviderMapper.class})
public interface TmdbProviderMapper
        extends BaseMapper<TmdbProviderDto, TmdbProviderEntity> {

    String DEFAULT_REGION = "IN";

    /* ==========================================
       ENTITY LIST → DTO LIST (ONLY INDIA)
       ========================================== */

    @Override
    default List<TmdbProviderDto> toDtoList(List<TmdbProviderEntity> entities) {

        if (entities == null) {
            return List.of();
        }

        return entities.stream()
                .filter(e -> DEFAULT_REGION.equalsIgnoreCase(e.getRegionCode()))
                .map(this::toDto)
                .toList();
    }

    /* ==========================================
       ENTITY SET → DTO LIST (ONLY INDIA)
       ========================================== */

    default List<TmdbProviderDto> toDtoList(Set<TmdbProviderEntity> entities) {

        if (entities == null) {
            return List.of();
        }

        return entities.stream()
                .filter(e -> DEFAULT_REGION.equalsIgnoreCase(e.getRegionCode()))
                .map(this::toDto)
                .toList();
    }

     /* ==========================================
       PROJECTION → DTO
       ========================================== */

//    default TmdbProviderDto fromProjection(ProviderProjection p) {
//
//        if (p == null) {
//            return null;
//        }
//
//        ProviderDto provider = new ProviderDto();
//        provider.setId(p.getProviderId());
//        provider.setName(p.getProviderName());
//        provider.setLogoPath(p.getLogoPath());
//        provider.setDisplayPriority(p.getDisplayPriority());
//
//        TmdbProviderDto dto = new TmdbProviderDto();
//        dto.setId(p.getTmdbProviderId());
//        dto.setProvider(provider);
//        dto.setProviderType(p.getProviderType());
//        dto.setRegionCode(DEFAULT_REGION);
//
//        return dto;
//    }

    @Mapping(target = "provider.id", source = "providerId")
    @Mapping(target = "provider.name", source = "providerName")
    @Mapping(target = "provider.logoPath", source = "logoPath")
    @Mapping(target = "provider.displayPriority", source = "displayPriority")
    @Mapping(target = "id", source = "tmdbProviderId")
    @Mapping(target = "regionCode", constant = DEFAULT_REGION)
    TmdbProviderDto fromProjection(ProviderProjection projection);

    default List<TmdbProviderDto> fromProjectionList(List<ProviderProjection> projections) {

        if (projections == null || projections.isEmpty()) {
            return List.of();
        }

        return projections.stream()
                .map(this::fromProjection)
                .toList();
    }

    /* ==========================================
       ENTITY COLLECTION → DTO LIST BY REGION
       ========================================== */

    default List<TmdbProviderDto> toDtoByRegion(
            Iterable<TmdbProviderEntity> entities,
            String region
    ) {

        if (entities == null || region == null) {
            return List.of();
        }

        return java.util.stream.StreamSupport.stream(entities.spliterator(), false)
                .filter(e -> region.equalsIgnoreCase(e.getRegionCode()))
                .map(this::toDto)
                .toList();
    }
}