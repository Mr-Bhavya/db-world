package com.db.dbworld.app.cinema.tmdb.collection.entity;

import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@Entity
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "tmdb_collections", schema = "new_db_world")
public class CollectionEntity {

    @Id
    private Long id;

    private String name;

    private String posterPath;

    private String backdropPath;

}