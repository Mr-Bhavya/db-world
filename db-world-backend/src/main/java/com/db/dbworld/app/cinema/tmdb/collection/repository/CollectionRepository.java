package com.db.dbworld.app.cinema.tmdb.collection.repository;

import com.db.dbworld.cinema.tmdb.collection.entity.CollectionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CollectionRepository extends JpaRepository<CollectionEntity, Long> {
}
