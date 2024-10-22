package com.db.dbworld.entities.dbcinema.tmdb.providers;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
//@Entity
//@EqualsAndHashCode(of = {"provider_id"})
//@Table(name="PROVIDER", schema = "db_world")
//@Inheritance(strategy = InheritanceType.TABLE_PER_CLASS)
//@DiscriminatorColumn(name="provider_type", discriminatorType = DiscriminatorType.STRING)
public abstract class ProviderEntity {

//    @Id
//    @Column(name = "id")
    private Long provider_id;
    private String logo_path;
    private String provider_name;

//    @ManyToMany(mappedBy = "providers")
//    private List<TmdbDataEntity> tmdbDataEntityList;
}
