package com.db.dbworld.app.cinema.tmdb.country.entity;

import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@Entity
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "production_countries", schema = "new_db_world")
public class ProductionCountryEntity {

    @Id
    @Column(name = "iso_3166_1", length = 2)
    private String isoCode;

    private String englishName;

    private String nativeName;

}