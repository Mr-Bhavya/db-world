package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
public class ProvidersTmdbResponse {

    private Long id;

    private Map<String, ProviderRegionTmdbResponse> results;

}