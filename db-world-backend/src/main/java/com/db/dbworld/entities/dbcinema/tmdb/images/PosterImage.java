package com.db.dbworld.entities.dbcinema.tmdb.images;

import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;

@Entity
@DiscriminatorValue("posters")
public class PosterImage extends ImagesEntity {
}
