package com.db.dbworld.app.cinema.tmdb.providers.repository;

import com.db.dbworld.app.cinema.tmdb.enums.ProviderType;
import com.db.dbworld.app.cinema.tmdb.providers.entity.ProviderEntity;
import com.db.dbworld.app.cinema.tmdb.providers.entity.TmdbProviderEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProviderRepository extends JpaRepository<ProviderEntity, Long> {
}