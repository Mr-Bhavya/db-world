package com.db.dbworld.app.cinema.rail.repository;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.rail.entity.RailItemEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface RailItemRepository extends JpaRepository<RailItemEntity, Long> {

    Slice<RailItemEntity> findByRailIdOrderByPriorityAsc(Long railId, Pageable pageable);

    boolean existsByRailIdAndRecordId(Long railId, Long recordId);

    @Query("""
                SELECT ri
                FROM RailItemEntity ri
                JOIN FETCH ri.record r
                WHERE ri.rail.id IN :railIds
                ORDER BY ri.priority
            """)
    List<RailItemEntity> findByRailIds(List<Long> railIds);

    @Query("""
                SELECT ri.record
                FROM RailItemEntity ri
                WHERE ri.rail.id = :railId
                ORDER BY ri.priority ASC
            """)
    List<RecordEntity> findRecordsByRailIdPaged(
            @Param("railId") Long railId,
            Pageable pageable
    );

}