package com.db.dbworld.entities.dbcinema.tmdb.providers;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Entity
//@DiscriminatorValue("flatrate")
@Table(name = "FLATRATE_PROVIDER")
public class FlatRateEntity {
    @Id
    @Column(name = "provider_id")
    private Long provider_id;
    private String logo_path;
    private String provider_name;

    @ManyToMany(mappedBy = "flatRate", cascade = CascadeType.ALL)
    private List<ProvidersEntity> provider_flatrate_map;

}
