package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProviderTmdbResponse {

    private Long provider_id;

    private String provider_name;

    private String logo_path;

    private Integer display_priority;

}