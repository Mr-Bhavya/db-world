package com.db.dbworld.app.cinema.tmdb.people.repository;

import com.db.dbworld.app.cinema.tmdb.credits.entity.CreditEntity;
import com.db.dbworld.app.cinema.tmdb.people.entity.PersonEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PersonRepository extends JpaRepository<PersonEntity, Long> {
    List<PersonEntity> findTop50ByPersonSyncedFalse();
    Page<PersonEntity> findByPersonSyncedFalse(Pageable pageable);
    long countByPersonSyncedFalse();

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
