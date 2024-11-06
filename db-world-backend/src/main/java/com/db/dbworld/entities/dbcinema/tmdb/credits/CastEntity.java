package com.db.dbworld.entities.dbcinema.tmdb.credits;

import jakarta.persistence.*;
import lombok.Data;

import java.util.Objects;

@Data
@Entity
@Table(name = "CAST", schema = "db_world")
public class CastEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST})
    @JoinColumn(name = "person")
    private PersonEntity person;

    @Column(name = "cast_id")
    private Long cast_id;

    @ManyToOne(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST})
    @JoinColumn(name = "cast_character", nullable = false)
    private CharacterEntity character;

    @Column(name = "cast_order")
    private Long order;

    @ManyToOne(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "credit")
    private CreditsEntity creditsEntity;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        CastEntity that = (CastEntity) o;
        return Objects.equals(person, that.person) && Objects.equals(cast_id, that.cast_id) && Objects.equals(order, that.order);
    }

    @Override
    public int hashCode() {
        return Objects.hash(person, cast_id, order);
    }
}
