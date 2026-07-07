package com.db.dbworld.app.cinema.tmdb.media.entity;

import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@Entity
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "images", schema = "db_world")
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "image_type")
public abstract class ImageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tmdb_id", nullable = false)
    private TmdbEntity tmdb;

    private String filePath;

    private double aspectRatio;

    private Integer width;

    private Integer height;

    private double voteAverage;

    private Integer voteCount;

    @Column(name = "language_code")
    private String iso6391;

}