package com.db.dbworld.entities.dbcinema;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.mongodb.core.mapping.Document;


@Getter
@Setter
@Document("MOVIE_TMDB_DATA")
@EqualsAndHashCode(callSuper = true)
public class MovieTmdbDataEntity extends TmdbDataEntity {

    private long budget;
    private String imdb_id;
    private String release_date; //first_air_date
    private long revenue;
    private int runtime;
    private boolean video;

}
