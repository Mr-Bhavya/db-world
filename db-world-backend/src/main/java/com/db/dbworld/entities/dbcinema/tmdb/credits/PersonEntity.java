package com.db.dbworld.entities.dbcinema.tmdb.credits;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;

@Data
@Entity
@Table(name = "PERSON", schema = "db_world")
public class PersonEntity {

    @Id
    @Column(name = "id")
    private long id;

    @OneToMany(mappedBy = "person")
    private List<CrewEntity> crewEntities;

    @OneToMany(mappedBy = "person")
    private List<CastEntity> castEntities;

    private boolean adult;
    private long gender;
    private String known_for_department;
    private String name;
    private String original_name;
    private double popularity;
    private String profile_path;
    private String credit_id;
}
