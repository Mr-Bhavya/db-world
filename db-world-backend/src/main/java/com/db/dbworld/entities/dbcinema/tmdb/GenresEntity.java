package com.db.dbworld.entities.dbcinema.tmdb;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name="GENRES", schema = "db_world")
public class GenresEntity implements Serializable {
    @Id
    @Column(name = "id")
    private int id;
    private String name;

    @ManyToMany(mappedBy = "genres")
    private List<TmdbDataEntity> tmdbDataEntityList;
}
