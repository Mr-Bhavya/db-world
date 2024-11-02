package com.db.dbworld.entities.dbcinema.tmdb.providers;

import com.db.dbworld.entities.dbcinema.tmdb.TmdbDataEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Entity
@Table(name="DB_PROVIDERS", schema = "db_world")
public class ProvidersEntity {

    @Id
    @GeneratedValue(strategy=GenerationType.AUTO)
    private long id;

    @OneToOne(fetch = FetchType.EAGER, cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "tmdb", referencedColumnName = "id", unique = true)
    private TmdbDataEntity tmdb;

    @ManyToMany(fetch = FetchType.EAGER, cascade = CascadeType.ALL)
    @JoinTable(name = "provider_buy_map", joinColumns = @JoinColumn(name = "db_provider_id"),
            inverseJoinColumns = @JoinColumn(name = "provider_id"))
    private List<BuyEntity> buy;

    @ManyToMany(fetch = FetchType.EAGER, cascade = CascadeType.ALL)
    @JoinTable(name = "provider_rent_map", joinColumns = @JoinColumn(name = "db_provider_id"),
            inverseJoinColumns = @JoinColumn(name = "provider_id"))
    private List<RentEntity> rent;

    @ManyToMany(fetch = FetchType.EAGER, cascade = CascadeType.ALL)
    @JoinTable(name = "provider_flatrate_map", joinColumns = @JoinColumn(name = "db_provider_id"),
            inverseJoinColumns = @JoinColumn(name = "provider_id"))
    private List<FlatRateEntity> flatRate;
}
