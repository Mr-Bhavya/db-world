package com.db.dbworld.dao.dbcinema.tmdb;

import com.db.dbworld.entities.dbcinema.tmdb.VideosEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VideosRepository extends JpaRepository<VideosEntity, String> {
}
