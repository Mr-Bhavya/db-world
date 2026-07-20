package com.db.dbworld.app.cinema.tmdb.media.repository;

import com.db.dbworld.app.cinema.tmdb.media.entity.PosterImageEntity;
import com.db.dbworld.app.cinema.tmdb.media.projection.PosterImageProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;

public interface PosterImageRepository extends JpaRepository<PosterImageEntity, Long> {
    List<PosterImageEntity> findAllByTmdbId(Long tmdbId);

    List<PosterImageEntity> findAllByTmdbIdIn(List<Long> tmdbIds);


    /**
     * Rail-facing fetch: returns only the poster rows the rail can actually use —
     * a non-null file path, at least {@code minHeight} tall, and limited to
     * no-text images ({@code iso6391 IS NULL}) or the relevant locales. This keeps
     * dozens of foreign-language posters per title out of the result set.
     */
    @Query("""
       SELECT
           p.tmdb.id as tmdbId,
           p.filePath as filePath,
           p.iso6391 as iso6391,
           p.height as height,
           p.voteAverage as voteAverage,
           p.voteCount as voteCount
       FROM PosterImageEntity p
       WHERE p.tmdb.id IN :tmdbIds
         AND p.filePath IS NOT NULL
         AND (p.height IS NULL OR p.height >= :minHeight)
         AND (p.iso6391 IS NULL OR p.iso6391 IN :locales)
       """)
    List<PosterImageProjection> findPostersByTmdbIds(
            Collection<Long> tmdbIds,
            Collection<String> locales,
            int minHeight);
}
