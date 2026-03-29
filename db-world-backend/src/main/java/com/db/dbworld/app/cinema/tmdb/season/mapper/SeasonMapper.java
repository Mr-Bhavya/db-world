package com.db.dbworld.app.cinema.tmdb.season.mapper;

import com.db.dbworld.app.cinema.tmdb.client.dto.SeasonTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.season.dto.SeasonDto;
import com.db.dbworld.app.cinema.tmdb.season.entity.SeasonEntity;
import com.db.dbworld.app.cinema.tmdb.mapper.BaseMapperConfig;

import org.mapstruct.AfterMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

import java.time.LocalDate;
import java.util.List;

@Mapper(
        config = BaseMapperConfig.class,
        uses = { EpisodeMapper.class }
)
public interface SeasonMapper {

    /* =====================================
       DTO → ENTITY
     ===================================== */

    @Mapping(target = "tvShow", ignore = true)
    SeasonEntity toEntity(SeasonDto dto);

    /* =====================================
       ENTITY → DTO
     ===================================== */

    SeasonDto toDto(SeasonEntity entity);

    /* =====================================
       TMDB → ENTITY
     ===================================== */

    @Mapping(source = "air_date", target = "airDate")
    @Mapping(source = "season_number", target = "seasonNumber")
    @Mapping(source = "poster_path", target = "posterPath")
    @Mapping(source = "vote_average", target = "voteAverage")
    @Mapping(target = "tvShow", ignore = true)
    SeasonEntity fromTmdb(SeasonTmdbResponse response);

    /* =====================================
       LIST HELPER
     ===================================== */

    default List<SeasonEntity> fromTmdbList(List<SeasonTmdbResponse> seasons) {

        if (seasons == null) {
            return List.of();
        }

        return seasons.stream()
                .map(this::fromTmdb)
                .toList();
    }

    /* ============================
       ATTACH EPISODE RELATION
     ============================ */

    @AfterMapping
    default void linkEpisodes(@MappingTarget SeasonEntity season) {

        if (season.getEpisodes() != null) {
            season.getEpisodes()
                    .forEach(e -> e.setSeason(season));
        }
    }


    /* =====================================
       STRING → LOCALDATE
     ===================================== */

    default LocalDate map(String date) {

        if (date == null || date.isBlank()) {
            return null;
        }

        return LocalDate.parse(date);
    }
}