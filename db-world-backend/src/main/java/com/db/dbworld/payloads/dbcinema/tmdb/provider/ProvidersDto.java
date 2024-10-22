package com.db.dbworld.payloads.dbcinema.tmdb.provider;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class ProvidersDto {
    private Long id;
    private String tmdb;
    private List<ProviderDto> rent;
    private List<ProviderDto> buy;
    private List<ProviderDto> flatrate;
}
