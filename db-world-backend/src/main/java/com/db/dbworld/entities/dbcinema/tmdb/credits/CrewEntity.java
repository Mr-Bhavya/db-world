package com.db.dbworld.entities.dbcinema.tmdb.credits;

import jakarta.persistence.*;
import lombok.Data;

import java.util.Objects;

@Data
@Entity
@Table(name = "CREW", schema = "db_world")
public class CrewEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST})
    @JoinColumn(name = "person")
    private PersonEntity person;

    @ManyToOne(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST})
    @JoinColumn(name = "department")
    private DepartmentEntity department;

    @ManyToOne(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST})
    @JoinColumn(name = "job")
    private JobEntity job;

    @ManyToOne(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "credit")
    private CreditsEntity creditsEntity;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        CrewEntity that = (CrewEntity) o;
        return Objects.equals(person, that.person) && Objects.equals(department, that.department) && Objects.equals(job, that.job);
    }

    @Override
    public int hashCode() {
        return Objects.hash(person, department, job);
    }
}
