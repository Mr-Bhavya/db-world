package com.db.dbworld.app.cinema.tmdb.season.mapper;

import com.db.dbworld.cinema.tmdb.client.dto.EpisodeTmdbResponse;
import com.db.dbworld.cinema.tmdb.mapper.BaseMapper;
import com.db.dbworld.cinema.tmdb.mapper.BaseMapperConfig;
import com.db.dbworld.cinema.tmdb.season.dto.EpisodeDto;
import com.db.dbworld.cinema.tmdb.season.entity.EpisodeEntity;
import com.db.dbworld.cinema.tmdb.season.entity.SeasonEntity;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.time.LocalDate;
import java.util.List;

@Mapper(config = BaseMapperConfig.class)
public interface EpisodeMapper extends BaseMapper<EpisodeDto, EpisodeEntity> {

    /* ============================
       DTO → ENTITY
     ============================ */

    @Mapping(target = "season", ignore = true)
    EpisodeEntity toEntity(EpisodeDto dto);

    /* ============================
       ENTITY → DTO
     ============================ */

    EpisodeDto toDto(EpisodeEntity entity);

    /* ============================
       TMDB → ENTITY
     ============================ */

    @Mapping(source = "air_date", target = "airDate")
    @Mapping(source = "episode_number", target = "episodeNumber")
    @Mapping(source = "season_number", target = "seasonNumber")
    @Mapping(source = "still_path", target = "stillPath")
    @Mapping(source = "vote_average", target = "voteAverage")
    @Mapping(source = "vote_count", target = "voteCount")
    @Mapping(target = "season", ignore = true)
    EpisodeEntity fromTmdb(EpisodeTmdbResponse response);

    /* ============================
       TMDB LIST → ENTITY LIST
     ============================ */

    default List<EpisodeEntity> fromTmdbList(
            List<EpisodeTmdbResponse> responses,
            SeasonEntity season
    ) {

        if (responses == null) return List.of();

        List<EpisodeEntity> episodes = responses.stream()
                .map(this::fromTmdb)
                .toList();

        episodes.forEach(e -> e.setSeason(season));

        return episodes;
    }

    /* ============================
       STRING → LOCALDATE
     ============================ */

    default LocalDate map(String date) {

        if (date == null || date.isBlank()) {
            return null;
        }

        return LocalDate.parse(date);
    }
}