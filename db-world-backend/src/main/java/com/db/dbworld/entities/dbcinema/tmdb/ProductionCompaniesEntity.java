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
@Table(name="PRODUCTION_COMPANIES", schema = "db_world")
public class ProductionCompaniesEntity implements Serializable {
    @Id
    private int id;
    private String logo_path;
    private String name;
    private String origin_country;

    @ManyToMany(mappedBy = "production_companies")
    private List<TmdbDataEntity> tmdbDataEntityList;
}
