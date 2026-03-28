package com.db.dbworld.app.cinema.tmdb.genre.repository;

import com.db.dbworld.cinema.enums.RecordType;
import com.db.dbworld.cinema.tmdb.genre.dto.TmdbGenreProjection;
import com.db.dbworld.cinema.tmdb.genre.entity.GenreEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface GenreRepository extends JpaRepository<GenreEntity, Long> {

    @Query("""
            SELECT t.id AS tmdbId, g AS genre
            FROM TmdbEntity t
            JOIN t.genres g
            WHERE t.id IN :tmdbIds
            """)
    List<TmdbGenreProjection> findGenresByTmdbIds(List<Long> tmdbIds);

    /**
     * Genres that have at least one record (across all types).
     * Used for HOME page categories.
     */
    @Query("""
            SELECT DISTINCT g
            FROM RecordEntity r
            JOIN r.tmdb t
            JOIN t.genres g
            ORDER BY g.name
            """)
    List<GenreEntity> findActiveGenres();

    /**
     * Genres that have at least one record of a specific type.
     * Used for MOVIES / SERIES page categories.
     */
    @Query("""
            SELECT DISTINCT g
            FROM RecordEntity r
            JOIN r.tmdb t
            JOIN t.genres g
            WHERE r.type = :recordType
            ORDER BY g.name
            """)
    List<GenreEntity> findActiveGenresByRecordType(RecordType recordType);
}
