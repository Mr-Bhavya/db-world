package com.db.dbworld.app.cinema.tmdb.credits.mapper;

import com.db.dbworld.cinema.tmdb.client.dto.*;
import com.db.dbworld.cinema.tmdb.credits.dto.CreditDto;
import com.db.dbworld.cinema.tmdb.credits.entity.CreditEntity;
import com.db.dbworld.cinema.tmdb.mapper.BaseMapperConfig;
import com.db.dbworld.cinema.tmdb.people.mapper.PersonMapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.ArrayList;
import java.util.List;

@Mapper(
        config = BaseMapperConfig.class,
        uses = {PersonMapper.class}
)
public interface CreditMapper {

    /* =====================================
       DTO → ENTITY
     ===================================== */

    @Mapping(target = "tmdb", ignore = true)
    CreditEntity toEntity(CreditDto dto);

    /* =====================================
       ENTITY → DTO
     ===================================== */

    CreditDto toDto(CreditEntity entity);

    /* =====================================
       TMDB → ENTITY (CAST)
     ===================================== */

    @Mapping(source = "order", target = "castOrder")
    @Mapping(source = "credit_id", target = "creditId")
    @Mapping(source = ".", target = "person")
    @Mapping(target = "creditType", constant = "CAST")
    @Mapping(target = "tmdb", ignore = true)
    CreditEntity fromTmdbCast(CreditTmdbResponse response);

    /* =====================================
       TMDB → ENTITY (CREW)
     ===================================== */

    @Mapping(source = "order", target = "castOrder")
    @Mapping(source = "credit_id", target = "creditId")
    @Mapping(source = ".", target = "person")
    @Mapping(target = "creditType", constant = "CREW")
    @Mapping(target = "character", ignore = true)
    @Mapping(target = "tmdb", ignore = true)
    CreditEntity fromTmdbCrew(CreditTmdbResponse response);

    /* =====================================
       WRAPPER → ENTITY LIST
     ===================================== */

    default List<CreditEntity> fromTmdb(CreditsTmdbResponse response) {

        if (response == null) return List.of();

        List<CreditEntity> credits = new ArrayList<>();

        if (response.getCast() != null) {
            response.getCast()
                    .forEach(c -> credits.add(fromTmdbCast(c)));
        }

        if (response.getCrew() != null) {
            response.getCrew()
                    .forEach(c -> credits.add(fromTmdbCrew(c)));
        }

        return credits;
    }
}