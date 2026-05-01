package com.db.dbworld.app.cinema.tmdb.client.dto;

import com.db.dbworld.app.cinema.tmdb.media.dto.VideoDto;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class VideosTmdbResponse {

    private Long id;

    private List<VideoTmdbResponse> results;

}