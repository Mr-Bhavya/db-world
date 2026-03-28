package com.db.dbworld.app.cinema.tmdb.providers.mapper;

import com.db.dbworld.cinema.tmdb.client.dto.*;
import com.db.dbworld.cinema.tmdb.mapper.BaseMapper;
import com.db.dbworld.cinema.tmdb.providers.dto.ProviderDto;
import com.db.dbworld.cinema.tmdb.providers.entity.*;
import com.db.dbworld.cinema.tmdb.enums.ProviderType;
import com.db.dbworld.cinema.tmdb.mapper.BaseMapperConfig;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.*;

@Mapper(config = BaseMapperConfig.class)
public interface ProviderMapper extends BaseMapper<ProviderDto, ProviderEntity> {

    /* =====================================
       TMDB → PROVIDER ENTITY
     ===================================== */

    @Mapping(source = "provider_id", target = "id")
    @Mapping(source = "provider_name", target = "name")
    @Mapping(source = "logo_path", target = "logoPath")
    @Mapping(source = "display_priority", target = "displayPriority")
    ProviderEntity toProviderEntity(ProviderTmdbResponse response);

    /* =====================================
       CREATE RELATION ENTITY
     ===================================== */

    default TmdbProviderEntity toRelation(
            ProviderTmdbResponse response,
            ProviderType type,
            String region,
            String link
    ) {

        TmdbProviderEntity entity = new TmdbProviderEntity();

        entity.setProvider(toProviderEntity(response));
        entity.setProviderType(type);
        entity.setRegionCode(region);
        entity.setLink(link);

        return entity;
    }

    /* =====================================
       REGION → LIST
     ===================================== */

    default Set<TmdbProviderEntity> fromRegion(
            ProviderRegionTmdbResponse region,
            String regionCode
    ) {

        Set<TmdbProviderEntity> providers = new HashSet<>();

        String link = region.getLink();

        if (region.getFlatrate() != null) {
            region.getFlatrate().forEach(p ->
                    providers.add(toRelation(p, ProviderType.FLATRATE, regionCode, link)));
        }

        if (region.getBuy() != null) {
            region.getBuy().forEach(p ->
                    providers.add(toRelation(p, ProviderType.BUY, regionCode, link)));
        }

        if (region.getRent() != null) {
            region.getRent().forEach(p ->
                    providers.add(toRelation(p, ProviderType.RENT, regionCode, link)));
        }

        return providers;
    }

    /* =====================================
       NETWORK → Provider
     ===================================== */

    default Set<TmdbProviderEntity> fromNetworks(
            List<NetworkTmdbResponse> networks
    ) {

        if (networks == null) return Set.of();

        Set<TmdbProviderEntity> result = new HashSet<>();

        for (NetworkTmdbResponse n : networks) {

            ProviderEntity provider = new ProviderEntity();
            provider.setId(n.getId());
            provider.setName(n.getName());
            provider.setLogoPath(n.getLogo_path());

            TmdbProviderEntity relation = new TmdbProviderEntity();
            relation.setProvider(provider);
            relation.setProviderType(ProviderType.NETWORK);

            result.add(relation);
        }

        return result;
    }

    /* =====================================
       WRAPPER → ENTITY LIST
     ===================================== */

    default Set<TmdbProviderEntity> fromTmdb(ProvidersTmdbResponse response) {

        if (response == null || response.getResults() == null) {
            return Set.of();
        }

        Set<TmdbProviderEntity> providers = new HashSet<>();

        for (Map.Entry<String, ProviderRegionTmdbResponse> entry : response.getResults().entrySet()) {

            String region = entry.getKey();
            ProviderRegionTmdbResponse regionData = entry.getValue();

            providers.addAll(fromRegion(regionData, region));
        }

        return providers;
    }
}