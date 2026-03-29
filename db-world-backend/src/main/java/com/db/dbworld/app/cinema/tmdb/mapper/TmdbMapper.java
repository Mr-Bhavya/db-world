package com.db.dbworld.app.cinema.tmdb.mapper;

import com.db.dbworld.app.cinema.tmdb.dto.TmdbDto;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;

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
        }
)
public interface TmdbMapper extends BaseMapper<TmdbDto, TmdbEntity> {

    @Override
    TmdbEntity toEntity(TmdbDto dto);

    @Override
    TmdbDto toDto(TmdbEntity entity);

}