package com.db.dbworld.payloads.dbcinema.tmdb;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProductionCompaniesDto {
    private int id;
    private String logo_path;
    private String name;
    private String origin_country;

}
