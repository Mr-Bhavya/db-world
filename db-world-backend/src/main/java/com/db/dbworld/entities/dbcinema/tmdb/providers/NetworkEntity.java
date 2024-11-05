package com.db.dbworld.entities.dbcinema.tmdb.providers;


import com.db.dbworld.entities.dbcinema.tmdb.SeriesTmdbDataEntity;
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
@Entity
@Table(name = "NETWORK_PROVIDER", schema = "db-world")
public class NetworkEntity {
    @Id
    private Long id;
    private String logo_path;
    private String name;
    private String origin_country;

    @ManyToMany(mappedBy = "networks")
    private List<SeriesTmdbDataEntity> seriesTmdbDataEntities;
}
