package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class TmdbResponse {

    private Long id;

    private boolean adult;

    private String backdrop_path;

    private String homepage;

    private String original_language;

    private String overview;

    private double popularity;

    private String poster_path;

    private String status;

    private String tagline;

    private double vote_average;

    private int vote_count;

    private List<GenreTmdbResponse> genres;

    private List<ProductionCompanyTmdbResponse> production_companies;

    private List<ProductionCountryTmdbResponse> production_countries;

    private List<SpokenLanguageTmdbResponse> spoken_languages;

    private VideosTmdbResponse videos;

    private ImagesTmdbResponse images;

    private CreditsTmdbResponse credits;

    private ProvidersTmdbResponse providers;

    private List<ReviewTmdbResponse> reviews;

}