package com.db.dbworld.app.cinema.tmdb.media.repository;

import com.db.dbworld.app.cinema.tmdb.media.entity.LogoImageEntity;
import com.db.dbworld.app.cinema.tmdb.media.projection.LogoImageProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;

public interface LogoImageRepository extends JpaRepository<LogoImageEntity, Long> {

    /**
     * Rail-facing fetch: title logos with a non-null file path, limited to
     * no-language ({@code iso6391 IS NULL}) or the relevant locales. No
     * min-height — logos are small by nature, so a height gate would drop them.
     */
    @Query("""
       SELECT
           l.tmdb.id as tmdbId,
           l.filePath as filePath,
           l.iso6391 as iso6391,
           l.height as height
       FROM LogoImageEntity l
       WHERE l.tmdb.id IN :tmdbIds
         AND l.filePath IS NOT NULL
         AND (l.iso6391 IS NULL OR l.iso6391 IN :locales)
       """)
    List<LogoImageProjection> findLogosByTmdbIds(Collection<Long> tmdbIds, Collection<String> locales);
}
