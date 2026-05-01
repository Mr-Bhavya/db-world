package com.db.dbworld.app.cinema.tmdb.mapper;

import com.db.dbworld.app.cinema.tmdb.client.dto.TvSeriesTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.company.mapper.ProductionCompanyMapper;
import com.db.dbworld.app.cinema.tmdb.country.mapper.ProductionCountryMapper;
import com.db.dbworld.app.cinema.tmdb.credits.mapper.CreditMapper;
import com.db.dbworld.app.cinema.tmdb.dto.TvSeriesTmdbDto;
import com.db.dbworld.app.cinema.tmdb.entities.TvSeriesTmdbEntity;

import com.db.dbworld.app.cinema.tmdb.genre.mapper.GenreMapper;
import com.db.dbworld.app.cinema.tmdb.language.mapper.SpokenLanguageMapper;
import com.db.dbworld.app.cinema.tmdb.media.mapper.ImageMapper;
import com.db.dbworld.app.cinema.tmdb.media.mapper.VideoMapper;
import com.db.dbworld.app.cinema.tmdb.people.mapper.PersonMapper;
import com.db.dbworld.app.cinema.tmdb.providers.mapper.ProviderMapper;
import com.db.dbworld.app.cinema.tmdb.review.mapper.ReviewMapper;
import com.db.dbworld.app.cinema.tmdb.season.mapper.SeasonMapper;
import org.mapstruct.*;

import java.util.ArrayList;
import java.util.HashSet;

@Mapper(
        config = BaseMapperConfig.class,
        uses = {
                GenreMapper.class,
                ProductionCompanyMapper.class,
                ProductionCountryMapper.class,
                SpokenLanguageMapper.class,
                VideoMapper.class,
                ImageMapper.class,
                CreditMapper.class,
                ProviderMapper.class,
                ReviewMapper.class,
                PersonMapper.class,
                SeasonMapper.class
        }
)
public interface TvSeriesTmdbMapper extends BaseMapper<TvSeriesTmdbDto, TvSeriesTmdbEntity> {

    /* =========================
       DTO ↔ ENTITY
     ========================= */

    @Override
    TvSeriesTmdbEntity toEntity(TvSeriesTmdbDto dto);

    @Override
    TvSeriesTmdbDto toDto(TvSeriesTmdbEntity entity);

    /* =========================
       TMDB → ENTITY
     ========================= */

    @Mapping(source = "name", target = "title")
    @Mapping(source = "original_name", target = "originalTitle")
    @Mapping(source = "production_companies", target = "productionCompanies")
    @Mapping(source = "production_countries", target = "productionCountries")
    @Mapping(source = "spoken_languages", target = "spokenLanguages")
    @Mapping(source = "backdrop_path", target = "backdropPath")
    @Mapping(source = "poster_path", target = "posterPath")
    @Mapping(source = "vote_average", target = "voteAverage")
    @Mapping(source = "vote_count", target = "voteCount")
    @Mapping(source = "first_air_date", target = "firstAirDate")
    @Mapping(source = "last_air_date", target = "lastAirDate")
    @Mapping(source = "number_of_episodes", target = "numberOfEpisodes")
    @Mapping(source = "number_of_seasons", target = "numberOfSeasons")
    @Mapping(source = "episode_run_time", target = "episodeRunTimes")
    @Mapping(source = "last_episode_to_air", target = "lastEpisodeToAir")
    @Mapping(source = "next_episode_to_air", target = "nextEpisodeToAir")
    @Mapping(source = "original_language", target = "originalLanguage")
    @Mapping(source = "created_by", target = "createdBy")
    // Seasons are managed separately by ingestSeasonsBlocking — mapping them here
    // creates plain-ArrayList episodes that corrupt Hibernate's PersistentBag
    // references when the entity is merged, causing the
    // "collection no longer referenced" HibernateException.
    @Mapping(target = "seasons", ignore = true)
    TvSeriesTmdbEntity fromTmdb(TvSeriesTmdbResponse response);

    /* =========================
       ADD NETWORKS AS PROVIDERS
     ========================= */

    @AfterMapping
    default void addNetworks(
            TvSeriesTmdbResponse source,
            @MappingTarget TvSeriesTmdbEntity target,
            ProviderMapper providerMapper
    ) {

        if (source.getNetworks() == null) return;

        if (target.getProviders() == null) {
            target.setProviders(new HashSet<>());
        }

        target.getProviders()
                .addAll(providerMapper.fromNetworks(source.getNetworks()));
    }

    @AfterMapping
    default void attachChildren(
            @MappingTarget TvSeriesTmdbEntity entity
    ) {

        if (entity.getVideos() != null) {
            entity.getVideos().forEach(v -> v.setTmdb(entity));
        }

        if (entity.getImages() != null) {
            entity.getImages().forEach(i -> i.setTmdb(entity));
        }

        if (entity.getCredits() != null) {
            entity.getCredits().forEach(c -> c.setTmdb(entity));
        }

        if (entity.getProviders() != null) {
            entity.getProviders().forEach(p -> p.setTmdb(entity));
        }

        if (entity.getReviews() != null) {
            entity.getReviews().forEach(r -> r.setTmdb(entity));
        }

        if (entity.getSeasons() != null) {

            entity.getSeasons().forEach(season -> {

                season.setTvShow(entity);

                if (season.getEpisodes() != null) {
                    season.getEpisodes()
                            .forEach(e -> e.setSeason(season));
                }

            });

        }
    }
}