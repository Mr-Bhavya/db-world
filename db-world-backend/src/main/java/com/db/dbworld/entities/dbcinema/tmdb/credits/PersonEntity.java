package com.db.dbworld.entities.dbcinema.tmdb.credits;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Objects;

@Getter
@Setter
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

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        PersonEntity that = (PersonEntity) o;
        return id == that.id && adult == that.adult && gender == that.gender && Double.compare(popularity, that.popularity) == 0 && Objects.equals(known_for_department, that.known_for_department) && Objects.equals(name, that.name) && Objects.equals(original_name, that.original_name) && Objects.equals(profile_path, that.profile_path) && Objects.equals(credit_id, that.credit_id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, adult, gender, known_for_department, name, original_name, popularity, profile_path, credit_id);
    }
}
