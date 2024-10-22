package com.db.dbworld.entities.dbcinema.tmdb.images;

import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;

@Entity
@DiscriminatorValue("backdrops")
public class BackDropImage extends ImagesEntity {
}
