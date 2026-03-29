package com.db.dbworld.app.cinema.tmdb.media.repository;

import com.db.dbworld.app.cinema.tmdb.media.entity.BackdropImageEntity;
import com.db.dbworld.app.cinema.tmdb.media.projection.BackdropImageProjection;
import com.db.dbworld.app.cinema.tmdb.media.projection.PosterImageProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;

public interface BackdropImageRepository extends JpaRepository<BackdropImageEntity, Long> {
    List<BackdropImageEntity> findAllByTmdbId(Long tmdbId);

    List<BackdropImageEntity> findAllByTmdbIdIn(List<Long> tmdbIds);

    @Query("""
       SELECT
           b.tmdb.id as tmdbId,
           b.filePath as filePath,
           b.iso6391 as iso6391,
           b.height as height
       FROM BackdropImageEntity b
       WHERE b.tmdb.id IN :tmdbIds
       """)
    List<BackdropImageProjection> findBackdropsByTmdbIds(Collection<Long> tmdbIds);
}
