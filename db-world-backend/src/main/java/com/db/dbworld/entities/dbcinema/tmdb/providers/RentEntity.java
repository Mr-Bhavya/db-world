package com.db.dbworld.entities.dbcinema.tmdb.providers;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "RENT_PROVIDER")
public class RentEntity{
    @Id
    @Column(name = "provider_id")
    private Long provider_id;
    private String logo_path;
    private String provider_name;

    @ManyToMany(mappedBy = "rent")
    private List<ProvidersEntity> provider_rent_map;

}
