package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class ProviderRegionTmdbResponse {

    private String link;

    private List<ProviderTmdbResponse> flatrate;

    private List<ProviderTmdbResponse> buy;

    private List<ProviderTmdbResponse> rent;

}