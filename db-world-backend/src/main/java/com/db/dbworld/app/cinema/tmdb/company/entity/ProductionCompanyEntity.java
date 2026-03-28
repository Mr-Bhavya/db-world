package com.db.dbworld.app.cinema.tmdb.company.entity;

import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@Entity
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "production_companies", schema = "db_world")
public class ProductionCompanyEntity {

    @Id
    private Long id;   // TMDB company id

    private String logoPath;

    private String name;

    private String originCountry;

}