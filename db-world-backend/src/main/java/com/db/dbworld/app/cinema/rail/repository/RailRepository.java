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

    /**
     * @deprecated single-page lookup; use {@link #findActiveByPage(PageType)} which honours
     * the {@code pageTypes} set so multi-page rails are returned for every page they include.
     */
    @Deprecated
    List<RailEntity> findByPageTypeAndActiveTrueOrderByPriorityAsc(PageType pageType);

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

    boolean existsByTitle(String title);

    Optional<RailEntity> findByTitle(String title);
}