package com.db.dbworld.payloads.dbcinema.tmdb.images;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class Image {
    private double aspect_ratio;
    private long height;
    private String iso_639_1;
    private String file_path;
    private double vote_average;
    private long vote_count;
    private long width;
}
