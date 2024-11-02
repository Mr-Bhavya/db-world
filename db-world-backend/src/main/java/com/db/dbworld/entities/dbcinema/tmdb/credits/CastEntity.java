package com.db.dbworld.entities.dbcinema.tmdb.credits;

import com.db.dbworld.entities.dbcinema.tmdb.TmdbDataEntity;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(of = "id")
@Entity
@Table(name = "CAST", schema = "db_world")
public class CastEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinColumn(name = "person")
    private PersonEntity person;

    @ManyToOne(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinColumn(name = "cast_character", nullable = false)
    private CharacterEntity character;

    @Column(name = "cast_order")
    private Long order;

    @OneToMany(fetch = FetchType.LAZY)
    @JoinColumn(name = "credit")
    private CreditsEntity creditsEntity;

}
