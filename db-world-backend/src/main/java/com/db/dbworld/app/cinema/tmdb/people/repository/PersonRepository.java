package com.db.dbworld.app.cinema.tmdb.people.repository;

import com.db.dbworld.app.cinema.tmdb.credits.entity.CreditEntity;
import com.db.dbworld.app.cinema.tmdb.people.entity.PersonEntity;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PersonRepository extends JpaRepository<PersonEntity, Long> {
    List<PersonEntity> findTop50ByPersonSyncedFalse();
    /** Keyset page of unsynced persons after {@code afterId}, so a walk never revisits a row. */
    List<PersonEntity> findByPersonSyncedFalseAndIdGreaterThanOrderByIdAsc(Long afterId, Limit limit);
    long countByPersonSyncedFalse();

    /** Cast/crew rows pointing at a person; they must go before the person row can (FK). */
    @Modifying
    @Query("DELETE FROM CreditEntity c WHERE c.person.id = :personId")
    int deleteCreditsOf(@Param("personId") Long personId);

    /** "Created by" links on TV series. No entity owns this join table, hence native SQL. */
    @Modifying
    @Query(value = "DELETE FROM db_world.tmdb_tv_created_by WHERE person_id = :personId", nativeQuery = true)
    int deleteTvCreatorLinksOf(@Param("personId") Long personId);

    /**
     * Filmography for a person — eager-fetches the tmdb entity (movie/tv) and its catalog
     * record so the caller can produce navigation links without N+1 queries.
     */
    @Query("""
           SELECT c FROM CreditEntity c
           JOIN FETCH c.tmdb t
           LEFT JOIN FETCH t.record
           WHERE c.person.id = :personId
           ORDER BY t.popularity DESC
           """)
    List<CreditEntity> findFilmography(@Param("personId") Long personId);
}
