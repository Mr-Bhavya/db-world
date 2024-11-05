package com.db.dbworld.entities.dbcinema.tmdb;

import com.db.dbworld.entities.dbcinema.tmdb.images.ImagesEntity;
import jakarta.persistence.*;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Entity
@EqualsAndHashCode(of = {"iso_639_1"})
@Table(name="SPOKEN_LANGUAGES", schema = "db_world")
public class SpokenLanguageEntity {
    @Id
    @Column(name = "iso_639_1", nullable = false, unique = true)
    private String iso_639_1;

    private String english_name;

    private String name;

    @ManyToMany(mappedBy = "spoken_languages")
    private List<TmdbDataEntity> tmdbDataEntities;

    @OneToMany(mappedBy = "iso_639_1")
    private List<ImagesEntity> imagesEntities;

    @OneToMany(mappedBy = "iso_639_1")
    private List<VideosEntity> videosEntities;

}
