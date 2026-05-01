package com.db.dbworld.app.cinema.catalog.repository;

import com.db.dbworld.app.cinema.catalog.dto.RecordAdminFilter;
import com.db.dbworld.app.cinema.catalog.dto.RecordAdminRowDto;
import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.domain.Specification;

public interface RecordRepositoryCustom {

    Page<RecordAdminRowDto> findAdminTable(
            RecordAdminFilter filter,
            Pageable pageable
    );

    /**
     * Returns record IDs matching a Specification, with proper sort support
     * for tmdb.* fields via joined paths.
     */
    Slice<Long> findIdsBySpecification(Specification<RecordEntity> spec, Pageable pageable);
}
