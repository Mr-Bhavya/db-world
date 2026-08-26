package com.db.dbworld.app.cinema.tmdb.providers.repository;

import com.db.dbworld.app.cinema.tmdb.enums.ProviderType;
import com.db.dbworld.app.cinema.tmdb.providers.entity.ProviderEntity;
import com.db.dbworld.app.cinema.tmdb.providers.entity.TmdbProviderEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

import java.util.Optional;

public interface ProviderRepository extends JpaRepository<ProviderEntity, Long> {

    /**
     * Providers that at least one catalogue title is actually available on, for the tag-rule
     * builder's dropdown.
     *
     * <p>Deliberately not {@code findAll()}: TMDB knows hundreds of providers worldwide and the
     * ingest stores every one it sees, so an unfiltered list would be unusable. This returns only
     * the ones present in {@code tmdb_providers}, ordered by TMDB's own display priority so the
     * majors (Netflix, Prime, Hotstar) come first.
     */
    @Query("""
            SELECT DISTINCT p
            FROM ProviderEntity p
            JOIN TmdbProviderEntity tp ON tp.provider = p
            ORDER BY p.displayPriority ASC, p.name ASC
            """)
    List<ProviderEntity> findInUse();
}