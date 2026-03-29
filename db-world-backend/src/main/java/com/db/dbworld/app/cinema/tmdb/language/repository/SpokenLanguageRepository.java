package com.db.dbworld.app.cinema.tmdb.language.repository;

import com.db.dbworld.app.cinema.tmdb.language.entity.SpokenLanguageEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SpokenLanguageRepository extends JpaRepository<SpokenLanguageEntity, String> {
}
