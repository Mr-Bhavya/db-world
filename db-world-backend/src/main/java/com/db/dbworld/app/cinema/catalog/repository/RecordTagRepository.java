package com.db.dbworld.app.cinema.catalog.repository;

import com.db.dbworld.cinema.catalog.entities.RecordTagEntity;
import com.db.dbworld.cinema.enums.RecordTagType;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecordTagRepository
        extends JpaRepository<RecordTagEntity, Long> {

    void deleteByTagType(RecordTagType recordTagType);
}
