package com.db.dbworld.entities.dbcinema.tmdb.credits;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

@Data
@Entity
@Table(name="CAST_CHARACTER", schema = "db_world")
public class CharacterEntity {

    @Id
    @Column(name = "name", nullable = false)
    private String name;

}
