package com.db.dbworld.payloads.dbcinema.tmdb.images;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class ImagesDto {
    private List<Image> backdrops;
    private List<Image> logos;
    private List<Image> posters;
}
