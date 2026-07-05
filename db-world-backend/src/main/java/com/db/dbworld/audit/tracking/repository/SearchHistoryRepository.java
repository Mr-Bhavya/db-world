package com.db.dbworld.audit.tracking.repository;

import com.db.dbworld.audit.tracking.admin.dto.SearchKeywordProjection;
import com.db.dbworld.audit.tracking.entity.SearchHistoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SearchHistoryRepository extends JpaRepository<SearchHistoryEntity, Long> {

    /** User's single most-recent row — used by the service's prefix-collapse check. */
    Optional<SearchHistoryEntity> findTopByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * Most recent distinct query per {@code query_norm} for a user, newest first.
     * Native MySQL: group by the normalized query, take the raw text of the most
     * recent hit in each group, order groups by their most recent occurrence.
     */
    @Query(value = """
            SELECT query_raw
            FROM (
                SELECT query_raw, query_norm, created_at,
                       ROW_NUMBER() OVER (PARTITION BY query_norm ORDER BY created_at DESC) AS rn
                FROM SEARCH_HISTORY
                WHERE user_id = :userId
            ) ranked
            WHERE rn = 1
            ORDER BY created_at DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<String> findRecentDistinctQueries(@Param("userId") Long userId, @Param("limit") int limit);

    @Modifying
    long deleteByUserId(Long userId);

    @Modifying
    long deleteByUserIdAndQueryNorm(Long userId, String queryNorm);

    /** Admin keywords: search volume + zero-result count per normalized query over a trailing window. */
    @Query(value = """
            SELECT
                query_norm                                                      AS queryNorm,
                COUNT(*)                                                        AS searchCount,
                SUM(CASE WHEN COALESCE(result_count, 0) = 0 THEN 1 ELSE 0 END)  AS zeroResultCount
            FROM SEARCH_HISTORY
            WHERE created_at >= (NOW() - INTERVAL :days DAY)
            GROUP BY query_norm
            ORDER BY searchCount DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<SearchKeywordProjection> findTopKeywords(@Param("days") int days, @Param("limit") int limit);
}
