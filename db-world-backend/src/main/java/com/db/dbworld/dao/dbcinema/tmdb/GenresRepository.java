package com.db.dbworld.dao.dbcinema.tmdb;

import com.db.dbworld.entities.dbcinema.tmdb.GenresEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GenresRepository extends JpaRepository<GenresEntity, Integer> {
}
