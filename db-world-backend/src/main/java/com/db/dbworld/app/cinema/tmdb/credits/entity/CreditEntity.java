package com.db.dbworld.app.cinema.tmdb.credits.entity;

import com.db.dbworld.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.cinema.tmdb.people.entity.PersonEntity;
import com.db.dbworld.cinema.tmdb.enums.CreditType;
import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@Entity
@AllArgsConstructor
@NoArgsConstructor
@Table(
        name = "tmdb_credits",
        schema = "db_world"
)public class CreditEntity {

    @Id
    @Column(name = "credit_id")
    private String creditId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tmdb_id", nullable = false)
    private TmdbEntity tmdb;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "person_id", nullable = false)
    private PersonEntity person;

    @Enumerated(EnumType.STRING)
    private CreditType creditType;

    private String department;

    private String job;

    @Column(name = "cast_character")
    private String character;

    private Integer castOrder;

}