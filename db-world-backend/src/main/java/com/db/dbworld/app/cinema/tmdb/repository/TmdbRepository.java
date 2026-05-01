package com.db.dbworld.app.cinema.tmdb.repository;

import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Each JOIN FETCH targets exactly one List (bag) collection per query.
 * Hibernate throws MultipleBagFetchException when a single JPQL query
 * tries to JOIN FETCH more than one bag simultaneously.
 * All queries must run within the same @Transactional session so that
 * Hibernate's L1 cache reuses the same entity instance across calls.
 */
@Repository
public interface TmdbRepository extends JpaRepository<TmdbEntity, Long> {

    @Query("SELECT DISTINCT t FROM TmdbEntity t LEFT JOIN FETCH t.genres WHERE t.id = :id")
    Optional<TmdbEntity> findWithGenres(@Param("id") Long id);

    @Query("SELECT DISTINCT t FROM TmdbEntity t LEFT JOIN FETCH t.videos WHERE t.id = :id")
    Optional<TmdbEntity> findWithVideos(@Param("id") Long id);

    @Query("SELECT DISTINCT t FROM TmdbEntity t LEFT JOIN FETCH t.images WHERE t.id = :id")
    Optional<TmdbEntity> findWithImages(@Param("id") Long id);

    @Query("SELECT DISTINCT t FROM TmdbEntity t LEFT JOIN FETCH t.reviews WHERE t.id = :id")
    Optional<TmdbEntity> findWithReviews(@Param("id") Long id);

    @Query("SELECT DISTINCT t FROM TmdbEntity t LEFT JOIN FETCH t.productionCompanies WHERE t.id = :id")
    Optional<TmdbEntity> findWithProductionCompanies(@Param("id") Long id);

    @Query("SELECT DISTINCT t FROM TmdbEntity t LEFT JOIN FETCH t.productionCountries WHERE t.id = :id")
    Optional<TmdbEntity> findWithProductionCountries(@Param("id") Long id);

    @Query("SELECT DISTINCT t FROM TmdbEntity t LEFT JOIN FETCH t.spokenLanguages WHERE t.id = :id")
    Optional<TmdbEntity> findWithSpokenLanguages(@Param("id") Long id);

    /**
     * Initialises the credits bag together with each credit's person,
     * eliminating N+1 per person.
     */
    @Query("""
            SELECT DISTINCT t FROM TmdbEntity t
            LEFT JOIN FETCH t.credits c
            LEFT JOIN FETCH c.person
            WHERE t.id = :id
            """)
    Optional<TmdbEntity> findWithCredits(@Param("id") Long id);

    /**
     * Initialises the providers bag together with each entry's ProviderEntity,
     * eliminating N+1 per provider lookup.
     * providers is a Set so it can be combined with credits — but kept separate
     * here for clarity and to avoid any cross-bag interference.
     */
    @Query("""
            SELECT DISTINCT t FROM TmdbEntity t
            LEFT JOIN FETCH t.providers p
            LEFT JOIN FETCH p.provider
            WHERE t.id = :id
            """)
    Optional<TmdbEntity> findWithProviders(@Param("id") Long id);

    /**
     * TV-only: initialises the seasons bag (episodes loaded separately via SeasonRepository
     * to avoid MultipleBagFetchException when fetching two List collections in one query).
     */
    @Query("""
            SELECT DISTINCT t FROM TmdbEntity t
            LEFT JOIN FETCH t.seasons
            WHERE t.id = :id
            """)
    Optional<TmdbEntity> findWithSeasons(@Param("id") Long id);

}
