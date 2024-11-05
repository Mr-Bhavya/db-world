package com.db.dbworld.entities.dbcinema.tmdb.providers;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "BUY_PROVIDER", schema = "db-world")
public class BuyEntity {
    @Id
    @Column(name = "provider_id")
    private Long provider_id;
    private String logo_path;
    private String provider_name;

    @ManyToMany(mappedBy = "buy", cascade = CascadeType.ALL)
    private List<ProvidersEntity> provider_buy_map;

}
