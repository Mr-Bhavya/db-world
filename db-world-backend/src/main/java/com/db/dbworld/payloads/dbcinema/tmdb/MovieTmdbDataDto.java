package com.db.dbworld.payloads.dbcinema.tmdb;

import lombok.Data;
import lombok.EqualsAndHashCode;


@Data
@EqualsAndHashCode(callSuper = true)
public class MovieTmdbDataDto extends TmdbDataDto {

    private String imdb_id;
    private String release_date; //first_air_date
    private int runtime;
    private long budget;
    private long revenue;
    private boolean video;
}
