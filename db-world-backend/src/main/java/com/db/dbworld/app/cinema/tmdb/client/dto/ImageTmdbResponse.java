package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ImageTmdbResponse {

    private Long id;

    private String file_path;

    private double aspect_ratio;

    private int width;

    private int height;

    private double vote_average;

    private int vote_count;

    private String iso_639_1;

}