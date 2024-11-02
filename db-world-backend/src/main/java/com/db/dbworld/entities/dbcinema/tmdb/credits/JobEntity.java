package com.db.dbworld.entities.dbcinema.tmdb.credits;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(of = "id")
@Entity
@Table(name="CREW_JOB", schema = "db_world")
public class JobEntity {


    @Id
    @Column(name = "name")
    private String name;

}
