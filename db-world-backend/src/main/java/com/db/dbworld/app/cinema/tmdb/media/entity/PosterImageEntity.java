package com.db.dbworld.app.cinema.tmdb.media.entity;

import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;

@Entity
@DiscriminatorValue("POSTER")
public class PosterImageEntity extends ImageEntity {
}
