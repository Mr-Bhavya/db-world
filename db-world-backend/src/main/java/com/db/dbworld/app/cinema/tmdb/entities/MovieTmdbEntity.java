package com.db.dbworld.app.cinema.tmdb.entities;

import com.db.dbworld.app.cinema.tmdb.collection.entity.CollectionEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@DiscriminatorValue("MOVIE")
public class MovieTmdbEntity extends TmdbEntity {

    private long budget;

    private String imdbId;

    private String releaseDate;

    private long revenue;

    private Integer runtime;

    private boolean video;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "collection_id")
    private CollectionEntity belongsToCollection;

}