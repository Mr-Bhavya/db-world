package com.db.dbworld.app.cinema.rail.repository;

import com.db.dbworld.app.cinema.enums.PageType;
import com.db.dbworld.app.cinema.rail.entity.RailEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface RailRepository extends JpaRepository<RailEntity, Long> {

    List<RailEntity> findByActiveTrueOrderByPriorityAsc();

    @Query("""
            SELECT r
            FROM RailEntity r
            WHERE r.active = true
            ORDER BY r.priority
            """)
    List<RailEntity> findActiveRails();

    List<RailEntity> findByPageTypeAndActiveTrueOrderByPriorityAsc(PageType pageType);

    boolean existsByTitle(String title);

    Optional<RailEntity> findByTitle(String title);
}