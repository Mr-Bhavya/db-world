package com.db.dbworld.app.cinema.tmdb.media.entity;

import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;

@Entity
@DiscriminatorValue("BACKDROP")
public class BackdropImageEntity extends ImageEntity {
}
