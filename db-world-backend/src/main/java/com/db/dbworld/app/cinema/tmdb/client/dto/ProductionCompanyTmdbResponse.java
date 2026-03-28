package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProductionCompanyTmdbResponse {

    private Long id;

    private String logo_path;

    private String name;

    private String origin_country;

}