package com.db.dbworld.entities.dbcinema.tmdb.credits;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@Entity
@Table(name="CAST_CHARACTER", schema = "db_world")
public class CharacterEntity {

    @Id
    @Column(name = "name", nullable = false)
    private String name;

}
