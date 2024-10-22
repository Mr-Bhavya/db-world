package com.db.dbworld.payloads.dbcinema.tmdb;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class SpokenLanguageDto {
    private String iso_639_1;
    private String english_name;
    private String name;
    private List<TmdbDataDto> tmdbDataDtoList;
}
