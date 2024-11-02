package com.db.dbworld.entities.dbcinema.tmdb.credits;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(of = "id")
@Entity
@Table(name="CREW_DEPARTMENT", schema = "db_world")
public class DepartmentEntity {

    @Id
    @Column(name = "name")
    private String name;

}
