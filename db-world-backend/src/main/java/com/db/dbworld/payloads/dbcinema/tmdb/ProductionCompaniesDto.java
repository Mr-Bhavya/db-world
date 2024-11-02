package com.db.dbworld.payloads.dbcinema.tmdb;

import com.db.dbworld.entities.dbcinema.tmdb.TmdbDataEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class ProductionCompaniesDto {
    private int id;
    private String logo_path;
    private String name;
    private String origin_country;

}
