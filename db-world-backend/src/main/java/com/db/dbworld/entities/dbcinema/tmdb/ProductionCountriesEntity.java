package com.db.dbworld.entities.dbcinema.tmdb;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Entity
@Table(name="PRODUCTION_COUNTRIES", schema = "db_world")
public class ProductionCountriesEntity {
    @Id
    private String iso_3166_1;
    private String english_name;
    private String native_name;

    @ManyToMany(mappedBy = "production_countries")
    private List<TmdbDataEntity> tmdbDataEntityList;
}
