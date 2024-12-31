package com.db.dbworld.entities.dbcinema.tmdb;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name="PRODUCTION_COUNTRIES", schema = "db_world")
public class ProductionCountriesEntity implements Serializable {
    @Id
    private String iso_3166_1;
    private String english_name;
    private String native_name;

    @ManyToMany(mappedBy = "production_countries")
    private List<TmdbDataEntity> tmdbDataEntityList;
}
