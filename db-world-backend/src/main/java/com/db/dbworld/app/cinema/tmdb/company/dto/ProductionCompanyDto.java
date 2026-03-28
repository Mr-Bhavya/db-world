package com.db.dbworld.app.cinema.tmdb.company.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProductionCompanyDto {

    private Long id;   // TMDB company id

    private String logoPath;

    private String name;

    private String originCountry;

}