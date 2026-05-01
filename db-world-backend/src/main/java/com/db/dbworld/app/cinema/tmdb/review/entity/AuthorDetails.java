package com.db.dbworld.app.cinema.tmdb.review.entity;

import jakarta.persistence.Embeddable;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Embeddable
public class AuthorDetails {

    private String name;

    private String username;

    private String avatarPath;

    private Double rating;

}