package com.db.dbworld.entities.dbcinema.tmdb.images;

import com.db.dbworld.entities.dbcinema.tmdb.SpokenLanguageEntity;
import com.db.dbworld.entities.dbcinema.tmdb.TmdbDataEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name="IMAGES", schema = "db_world")
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name="image_type", discriminatorType = DiscriminatorType.STRING)
public class ImagesEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE)
    @Column(name = "id")
    private int id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tmdb", referencedColumnName = "id")
    private TmdbDataEntity tmdbDataEntity;

//    private String type;
    private double aspect_ratio;
    private long height;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "iso_639_1", referencedColumnName = "iso_639_1")
    private SpokenLanguageEntity iso_639_1;

    private String file_path;
    private double vote_average;
    private long vote_count;
    private long width;
}
