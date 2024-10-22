package com.db.dbworld.entities.dbcinema.tmdb;

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
@Table(name="SPOKEN_LANGUAGES", schema = "db_world")
public class SpokenLanguageEntity {
    @Id
    private String iso_639_1;
    private String english_name;
    private String name;

    @ManyToMany(mappedBy = "spoken_languages")
    private List<TmdbDataEntity> tmdbDataEntityList;
}
