package com.db.dbworld.entities.dbcinema.tmdb.images;

import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;

@Entity
@DiscriminatorValue("logos")
public class LogoImage extends ImagesEntity {
}
