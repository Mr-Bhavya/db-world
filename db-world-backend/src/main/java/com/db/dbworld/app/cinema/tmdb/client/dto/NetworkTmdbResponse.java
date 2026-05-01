package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class NetworkTmdbResponse {

    private Long id;

    private String name;

    private String logo_path;

    private String origin_country;

}