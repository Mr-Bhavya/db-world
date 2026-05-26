package com.db.dbworld.app.cinema.rail.repository;

import com.db.dbworld.app.cinema.enums.PageType;
import com.db.dbworld.app.cinema.rail.entity.RailEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface RailRepository extends JpaRepository<RailEntity, Long> {

    @Query("""
            SELECT r
            FROM RailEntity r
            WHERE r.active = true
            ORDER BY r.priority
            """)
    List<RailEntity> findActiveRails();

    /**
     * Returns active rails whose {@code pageTypes} set contains {@code page}, ordered by
     * priority. Includes single-page rails ({HOME}, {MOVIES}, {SERIES}) and multi-page
     * rails ({HOME, MOVIES} etc.) that target the requested page.
     */
    @Query("""
            SELECT DISTINCT r FROM RailEntity r
            JOIN r.pageTypes p
            WHERE r.active = true AND p = :page
            ORDER BY r.priority
            """)
    List<RailEntity> findActiveByPage(PageType page);

    /**
     * Admin-facing list: every rail — active or not, with or without content — ordered
     * by priority. Used by the admin Rails Tab so disabled rails stay manageable and
     * newly-created rails appear immediately, before any records resolve.
     */
    @Query("""
            SELECT r FROM RailEntity r
            ORDER BY r.priority
            """)
    List<RailEntity> findAllOrderByPriority();

    /** Admin-facing list filtered to a given page. Same no-filter semantics as {@link #findAllOrderByPriority()}. */
    @Query("""
            SELECT DISTINCT r FROM RailEntity r
            JOIN r.pageTypes p
            WHERE p = :page
            ORDER BY r.priority
            """)
    List<RailEntity> findAllByPageOrderByPriority(PageType page);

    boolean existsByTitle(String title);

    Optional<RailEntity> findByTitle(String title);
}