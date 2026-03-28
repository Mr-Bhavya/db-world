package com.db.dbworld.app.cinema.tmdb.media.entity;

import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;

@Entity
@DiscriminatorValue("LOGO")
public class LogoImageEntity extends ImageEntity {
}
