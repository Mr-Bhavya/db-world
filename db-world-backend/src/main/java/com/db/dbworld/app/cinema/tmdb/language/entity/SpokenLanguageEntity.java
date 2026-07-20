package com.db.dbworld.app.cinema.tmdb.language.entity;

import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@Entity
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "spoken_languages", schema = "db_world")
public class SpokenLanguageEntity {

    @Id
    @Column(name = "iso_639_1", length = 2)
    private String isoCode;

    private String englishName;

    private String name;

}