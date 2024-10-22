package com.db.dbworld.payloads.dbcinema.tmdb;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class ProductionCountriesDto {

    private String iso_3166_1;
    private String english_name;
    private String native_name;
    private List<TmdbDataDto> tmdbDataDtoList;
}
