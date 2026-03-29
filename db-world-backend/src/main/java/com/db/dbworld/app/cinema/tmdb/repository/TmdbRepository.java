package com.db.dbworld.app.cinema.tmdb.repository;

import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TmdbRepository extends JpaRepository<TmdbEntity, Long> {

}