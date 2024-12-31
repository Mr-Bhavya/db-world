package com.db.dbworld.dao.dbcinema.tmdb;

import com.db.dbworld.entities.dbcinema.tmdb.TmdbDataEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TmdbDataRepository extends JpaRepository<TmdbDataEntity, Long> {

}
