package com.db.dbworld.app.cinema.tmdb.review.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AuthorDetailsDto {

    private String name;

    private String username;

    private String avatarPath;

    private Double rating;

}