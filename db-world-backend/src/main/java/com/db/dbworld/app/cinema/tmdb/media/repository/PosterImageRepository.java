package com.db.dbworld.app.cinema.tmdb.media.repository;

import com.db.dbworld.cinema.tmdb.media.entity.PosterImageEntity;
import com.db.dbworld.cinema.tmdb.media.projection.PosterImageProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;

public interface PosterImageRepository extends JpaRepository<PosterImageEntity, Long> {
    List<PosterImageEntity> findAllByTmdbId(Long tmdbId);

    List<PosterImageEntity> findAllByTmdbIdIn(List<Long> tmdbIds);


    @Query("""
       SELECT
           p.tmdb.id as tmdbId,
           p.filePath as filePath,
           p.iso6391 as iso6391,
           p.height as height
       FROM PosterImageEntity p
       WHERE p.tmdb.id IN :tmdbIds
       """)
    List<PosterImageProjection> findPostersByTmdbIds(Collection<Long> tmdbIds);
}
