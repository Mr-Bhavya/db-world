package com.db.dbworld.app.cinema.tmdb.dto;

import com.db.dbworld.cinema.tmdb.company.dto.ProductionCompanyDto;
import com.db.dbworld.cinema.tmdb.country.dto.ProductionCountryDto;
import com.db.dbworld.cinema.tmdb.credits.dto.CreditDto;
import com.db.dbworld.cinema.tmdb.genre.dto.GenreDto;
import com.db.dbworld.cinema.tmdb.language.dto.SpokenLanguageDto;
import com.db.dbworld.cinema.tmdb.media.dto.ImageDto;
import com.db.dbworld.cinema.tmdb.media.dto.VideoDto;
import com.db.dbworld.cinema.tmdb.providers.dto.ProviderDto;
import com.db.dbworld.cinema.tmdb.providers.dto.TmdbProviderDto;
import com.db.dbworld.cinema.tmdb.review.dto.ReviewDto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class TmdbDto {

    private Long id;

    private boolean adult;

    private String backdropPath;

    private String homepage;

    private String originalLanguage;

    private String originalTitle;

    private String overview;

    private double popularity;

    private String posterPath;

    private String status;

    private String tagline;

    private String title;

    private double voteAverage;

    private int voteCount;

    private List<GenreDto> genres;

    private List<ProductionCompanyDto> productionCompanies;

    private List<ProductionCountryDto> productionCountries;

    private List<SpokenLanguageDto> spokenLanguages;

    private List<VideoDto> videos;

    private List<ImageDto> images;

    private List<CreditDto> credits;

    private List<TmdbProviderDto> providers;

    private List<ReviewDto> reviews;

}