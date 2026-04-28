package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PersonTmdbResponse {

    private Long id;

    private boolean adult;

    private Integer gender;

    private String known_for_department;

    private String name;

    private String original_name;

    private double popularity;

    private String profile_path;

    private String imdb_id;

    private String homepage;

    private String biography;

    private String birthday;

    private String deathday;

    private String place_of_birth;

    private java.util.List<String> also_known_as;

}