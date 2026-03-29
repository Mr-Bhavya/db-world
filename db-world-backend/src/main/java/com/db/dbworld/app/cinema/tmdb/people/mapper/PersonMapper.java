package com.db.dbworld.app.cinema.tmdb.people.mapper;

import com.db.dbworld.app.cinema.tmdb.client.dto.PersonTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.people.dto.PersonDto;
import com.db.dbworld.app.cinema.tmdb.people.entity.PersonEntity;
import com.db.dbworld.app.cinema.tmdb.mapper.BaseMapperConfig;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.time.LocalDate;

@Mapper(config = BaseMapperConfig.class)
public interface PersonMapper {

    /* =====================================
       DTO → ENTITY
     ===================================== */

    @Mapping(target = "credits", ignore = true)
    @Mapping(target = "createdTvSeries", ignore = true)
    PersonEntity toEntity(PersonDto dto);

    /* =====================================
       ENTITY → DTO
     ===================================== */

    PersonDto toDto(PersonEntity entity);

    /* =====================================
       TMDB → ENTITY
     ===================================== */

    @Mapping(source = "known_for_department", target = "knownForDepartment")
    @Mapping(source = "original_name", target = "originalName")
    @Mapping(source = "profile_path", target = "profilePath")
    @Mapping(source = "imdb_id", target = "imdbId")
    @Mapping(source = "place_of_birth", target = "placeOfBirth")
    @Mapping(source = "birthday", target = "birthday")
    @Mapping(source = "deathday", target = "deathday")
    @Mapping(target = "credits", ignore = true)
    @Mapping(target = "createdTvSeries", ignore = true)
    @Mapping(target = "personSynced", constant = "false")
    PersonEntity fromTmdb(PersonTmdbResponse response);

    /* =====================================
       STRING → LOCALDATE CONVERSION
     ===================================== */

    default LocalDate map(String date) {

        if (date == null || date.isBlank()) {
            return null;
        }

        return LocalDate.parse(date);
    }
}