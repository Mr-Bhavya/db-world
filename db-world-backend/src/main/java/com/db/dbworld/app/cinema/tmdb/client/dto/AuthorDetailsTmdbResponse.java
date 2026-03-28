package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AuthorDetailsTmdbResponse {

    private String name;

    private String username;

    private String avatar_path;

    private Double rating;

}