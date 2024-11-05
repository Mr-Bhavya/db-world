package com.db.dbworld.entities.dbcinema.tmdb.credits;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;
import java.util.Objects;

@Data
@Entity
@Table(name="CREW_DEPARTMENT", schema = "db_world")
public class DepartmentEntity {

    @Id
    private String name;

    @OneToMany(mappedBy = "department")
    private List<CrewEntity> crewEntities;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        DepartmentEntity that = (DepartmentEntity) o;
        return this.name.equalsIgnoreCase(that.getName());
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(name);
    }
}
