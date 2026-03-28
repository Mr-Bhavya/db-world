package com.db.dbworld.app.cinema.tmdb.media.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class ImageResponseDto {

    private List<BackdropImageDto> backdrops;

    private List<PosterImageDto> posters;

    private List<LogoImageDto> logos;

}