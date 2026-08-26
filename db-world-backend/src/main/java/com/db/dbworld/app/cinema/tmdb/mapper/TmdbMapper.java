package com.db.dbworld.app.cinema.tmdb.mapper;

import com.db.dbworld.app.cinema.tmdb.dto.MovieTmdbDto;
import com.db.dbworld.app.cinema.tmdb.dto.TmdbDto;
import com.db.dbworld.app.cinema.tmdb.dto.TvSeriesTmdbDto;
import com.db.dbworld.app.cinema.tmdb.entities.MovieTmdbEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TvSeriesTmdbEntity;

import com.db.dbworld.app.cinema.tmdb.genre.mapper.GenreMapper;
import com.db.dbworld.app.cinema.tmdb.company.mapper.ProductionCompanyMapper;
import com.db.dbworld.app.cinema.tmdb.country.mapper.ProductionCountryMapper;
import com.db.dbworld.app.cinema.tmdb.language.mapper.SpokenLanguageMapper;

import com.db.dbworld.app.cinema.tmdb.media.mapper.ImageMapper;
import com.db.dbworld.app.cinema.tmdb.media.mapper.VideoMapper;

import com.db.dbworld.app.cinema.tmdb.credits.mapper.CreditMapper;
import com.db.dbworld.app.cinema.tmdb.providers.mapper.ProviderMapper;
import com.db.dbworld.app.cinema.tmdb.providers.mapper.TmdbProviderMapper;
import com.db.dbworld.app.cinema.tmdb.review.mapper.ReviewMapper;

import org.mapstruct.Mapper;
import org.mapstruct.SubclassMapping;

@Mapper(
        config = BaseMapperConfig.class,
        uses = {
                GenreMapper.class,
                ProductionCompanyMapper.class,
                ProductionCountryMapper.class,
                SpokenLanguageMapper.class,
                ImageMapper.class,
                VideoMapper.class,
                CreditMapper.class,
                ProviderMapper.class,
                ReviewMapper.class,
                TmdbProviderMapper.class,
                TvSeriesTmdbMapper.class,
                MovieTmdbMapper.class,
        }
)
public interface TmdbMapper extends BaseMapper<TmdbDto, TmdbEntity> {

    @Override
    TmdbEntity toEntity(TmdbDto dto);

    /**
     * Both subclasses must be mapped explicitly.
     *
     * Only the TV mapping existed, so a MovieTmdbEntity fell through to the
     * generated else-branch and came back as a plain TmdbDto — silently losing
     * every movie-only field on the PUBLIC catalog endpoint: belongsToCollection,
     * budget, revenue, runtime, releaseDate, imdbId and video. The admin TMDB
     * endpoint was unaffected because it calls MovieTmdbMapper directly, which
     * is why this only ever showed up on the viewer side.
     */
    @Override
    @SubclassMapping(source = TvSeriesTmdbEntity.class, target = TvSeriesTmdbDto.class)
    @SubclassMapping(source = MovieTmdbEntity.class, target = MovieTmdbDto.class)
    TmdbDto toDto(TmdbEntity entity);

}