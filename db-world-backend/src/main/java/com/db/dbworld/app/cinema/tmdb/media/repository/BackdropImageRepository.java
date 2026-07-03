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

    /**
     * Rail-facing fetch: returns only the backdrop rows the rail can actually use —
     * a non-null file path, at least {@code minHeight} tall, and limited to
     * no-text images ({@code iso6391 IS NULL}) or the relevant locales.
     */
    @Query("""
       SELECT
           b.tmdb.id as tmdbId,
           b.filePath as filePath,
           b.iso6391 as iso6391,
           b.height as height,
           b.voteAverage as voteAverage,
           b.voteCount as voteCount
       FROM BackdropImageEntity b
       WHERE b.tmdb.id IN :tmdbIds
         AND b.filePath IS NOT NULL
         AND (b.height IS NULL OR b.height >= :minHeight)
         AND (b.iso6391 IS NULL OR b.iso6391 IN :locales)
       """)
    List<BackdropImageProjection> findBackdropsByTmdbIds(
            Collection<Long> tmdbIds,
            Collection<String> locales,
            int minHeight);
}
