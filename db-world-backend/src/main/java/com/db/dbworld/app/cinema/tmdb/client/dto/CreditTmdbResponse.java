package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreditTmdbResponse {

    private Long id; // person id

    private String name;

    private String character;

    private Integer order;

    private String department;

    private String job;

    private String credit_id;

    private String profile_path;

}