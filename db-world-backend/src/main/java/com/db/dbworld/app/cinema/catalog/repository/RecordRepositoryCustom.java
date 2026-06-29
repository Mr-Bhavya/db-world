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
     * Admin records table — hand-built native query so sorting can target joined
     * columns (sync state, tmdb year) which Spring Data's native @Query sort cannot
     * (it prefixes the primary alias {@code r.}). {@code type}/{@code status} are
     * enum names or null; sort is applied from a safe allowlist.
     */
    Page<RecordAdminRowDto> findAdminTable(
            Long recordId,
            String name,
            String type,
            Long tmdbId,
            Integer year,
            String status,
            Pageable pageable
    );

    /**
     * Returns record IDs matching a Specification, with proper sort support
     * for tmdb.* fields via joined paths.
     */
    Slice<Long> findIdsBySpecification(Specification<RecordEntity> spec, Pageable pageable);
}
