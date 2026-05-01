package com.db.dbworld.app.cinema.tmdb.media.dto;

import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ImageDto {

    private Long id;

    private String filePath;

    private double aspectRatio;

    private int width;

    private int height;

    private double voteAverage;

    private int voteCount;

    private String iso6391;

}