package com.db.dbworld.app.cinema.tmdb.mapper;

import com.db.dbworld.app.cinema.tmdb.client.dto.MovieTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.collection.mapper.CollectionMapper;
import com.db.dbworld.app.cinema.tmdb.company.mapper.ProductionCompanyMapper;
import com.db.dbworld.app.cinema.tmdb.country.mapper.ProductionCountryMapper;
import com.db.dbworld.app.cinema.tmdb.credits.mapper.CreditMapper;
import com.db.dbworld.app.cinema.tmdb.dto.MovieTmdbDto;
import com.db.dbworld.app.cinema.tmdb.entities.MovieTmdbEntity;

import com.db.dbworld.app.cinema.tmdb.genre.mapper.GenreMapper;
import com.db.dbworld.app.cinema.tmdb.language.mapper.SpokenLanguageMapper;
import com.db.dbworld.app.cinema.tmdb.media.mapper.ImageMapper;
import com.db.dbworld.app.cinema.tmdb.media.mapper.VideoMapper;
import com.db.dbworld.app.cinema.tmdb.providers.mapper.ProviderMapper;
import com.db.dbworld.app.cinema.tmdb.review.mapper.ReviewMapper;
import org.mapstruct.*;

@Mapper(config = BaseMapperConfig.class,
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
                CollectionMapper.class
        })
public interface MovieTmdbMapper extends BaseMapper<MovieTmdbDto, MovieTmdbEntity> {

    /* =========================
       DTO ↔ ENTITY
     ========================= */

    @Override
    MovieTmdbEntity toEntity(MovieTmdbDto dto);

    @Override
    MovieTmdbDto toDto(MovieTmdbEntity entity);

    /* =========================
       TMDB → ENTITY
     ========================= */

    @Mapping(source = "production_companies", target = "productionCompanies")
    @Mapping(source = "production_countries", target = "productionCountries")
    @Mapping(source = "spoken_languages", target = "spokenLanguages")
    @Mapping(source = "original_title", target = "originalTitle")
    @Mapping(source = "original_language", target = "originalLanguage")
    @Mapping(source = "backdrop_path", target = "backdropPath")
    @Mapping(source = "poster_path", target = "posterPath")
    @Mapping(source = "vote_average", target = "voteAverage")
    @Mapping(source = "vote_count", target = "voteCount")
    @Mapping(source = "release_date", target = "releaseDate")
    @Mapping(source = "imdb_id", target = "imdbId")
    @Mapping(source = "belongs_to_collection", target = "belongsToCollection")
    MovieTmdbEntity fromTmdb(MovieTmdbResponse response);

    @AfterMapping
    default void attachChildren(
            @MappingTarget MovieTmdbEntity entity
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
    }

}