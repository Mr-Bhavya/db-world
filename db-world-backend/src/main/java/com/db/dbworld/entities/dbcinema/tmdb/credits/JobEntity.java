package com.db.dbworld.entities.dbcinema.tmdb.credits;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(of = "name")
@Entity
@Table(name="CREW_JOB", schema = "db_world")
public class JobEntity {

    @Id
    @Column(name = "name")
    private String name;

}
