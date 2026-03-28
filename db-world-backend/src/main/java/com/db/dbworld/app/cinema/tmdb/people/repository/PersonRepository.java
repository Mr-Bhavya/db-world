package com.db.dbworld.app.cinema.tmdb.people.repository;

import com.db.dbworld.cinema.tmdb.people.entity.PersonEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PersonRepository extends JpaRepository<PersonEntity, Long> {
    List<PersonEntity> findTop50ByPersonSyncedFalse();
}
