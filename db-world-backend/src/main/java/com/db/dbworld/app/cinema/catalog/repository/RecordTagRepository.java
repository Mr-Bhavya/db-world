package com.db.dbworld.app.cinema.catalog.repository;

import com.db.dbworld.app.cinema.catalog.entities.RecordTagEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecordTagRepository
        extends JpaRepository<RecordTagEntity, Long> {

    void deleteByTagType(String tagType);

    /** Dashboard: count how many records carry a given tag. */
    long countByTagType(String tagType);
}
