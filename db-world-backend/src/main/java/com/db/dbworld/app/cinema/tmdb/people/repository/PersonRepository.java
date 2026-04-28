package com.db.dbworld.app.cinema.tmdb.people.repository;

import com.db.dbworld.app.cinema.tmdb.people.entity.PersonEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PersonRepository extends JpaRepository<PersonEntity, Long> {
    List<PersonEntity> findTop50ByPersonSyncedFalse();
    Page<PersonEntity> findByPersonSyncedFalse(Pageable pageable);
    long countByPersonSyncedFalse();
}
