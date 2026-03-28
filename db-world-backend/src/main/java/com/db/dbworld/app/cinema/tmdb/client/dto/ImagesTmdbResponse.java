package com.db.dbworld.app.cinema.tmdb.client.dto;

import com.db.dbworld.cinema.tmdb.media.dto.BackdropImageDto;
import com.db.dbworld.cinema.tmdb.media.dto.LogoImageDto;
import com.db.dbworld.cinema.tmdb.media.dto.PosterImageDto;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class ImagesTmdbResponse {

    private List<BackdropImageTmdbResponse> backdrops;

    private List<PosterImageTmdbResponse> posters;

    private List<LogoImageTmdbResponse> logos;

}