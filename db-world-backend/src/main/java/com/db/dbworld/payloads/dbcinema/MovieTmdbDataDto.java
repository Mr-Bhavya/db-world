package com.db.dbworld.payloads.dbcinema;

import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.mapping.Document;


@Data
@Document("MOVIE_TMDB_DATA")
@EqualsAndHashCode(callSuper = true)
public class MovieTmdbDataDto extends TmdbDataDto {

    private String imdb_id;
    private String release_date; //first_air_date
    private int runtime;
    private long budget;
    private long revenue;
    private boolean video;
}
