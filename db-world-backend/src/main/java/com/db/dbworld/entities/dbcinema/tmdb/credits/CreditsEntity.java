package com.db.dbworld.entities.dbcinema.tmdb.credits;

import com.db.dbworld.entities.dbcinema.tmdb.TmdbDataEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name="CREDITS", schema = "db_world")
public class CreditsEntity implements Serializable {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "tmdb", referencedColumnName = "id", unique = true)
    private TmdbDataEntity tmdb;

    @OneToMany(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "credit")
    private List<CastEntity> cast;

    @OneToMany(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "credit")
    private List<CrewEntity> crew;

}
