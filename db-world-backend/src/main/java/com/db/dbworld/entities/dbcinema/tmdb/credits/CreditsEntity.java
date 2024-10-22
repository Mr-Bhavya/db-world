package com.db.dbworld.entities.dbcinema.tmdb.credits;

import com.db.dbworld.entities.dbcinema.tmdb.TmdbDataEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Entity
@Table(name="CREDITS", schema = "db_world")
public class CreditsEntity {

    @Id
    @GeneratedValue(strategy= GenerationType.AUTO)
    private long id;

    @OneToOne(fetch = FetchType.EAGER, cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "tmdb", referencedColumnName = "id", unique = true)
    private TmdbDataEntity tmdb;

    @ManyToMany(fetch = FetchType.EAGER, cascade = CascadeType.ALL)
    @JoinTable(name = "credit_cast_map", joinColumns = @JoinColumn(name = "credit"),
            inverseJoinColumns = @JoinColumn(name = "cast"))
    private List<CastEntity> cast;

    @ManyToMany(fetch = FetchType.EAGER, cascade = CascadeType.ALL)
    @JoinTable(name = "credit_crew_map", joinColumns = @JoinColumn(name = "credit"),
            inverseJoinColumns = @JoinColumn(name = "crew"))
    private List<CrewEntity> crew;

}
