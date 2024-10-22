package com.db.dbworld.entities.dbcinema.tmdb;

import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import lombok.Getter;
import lombok.Setter;


@Getter
@Setter
@Entity
@DiscriminatorValue("movie")
//@Table(name = "TMDB_MOVIE_DATA", schema = "db_world")
//@EqualsAndHashCode(callSuper = true)
public class MovieTmdbDataEntity extends TmdbDataEntity {

    private long budget;
    private String imdb_id;
    private String release_date; //first_air_date
    private long revenue;
    private int runtime;
    private boolean video;

}
