package com.db.dbworld.app.cinema.mediarequest.repository;

import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestEntity;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestKind;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MediaRequestRepository extends JpaRepository<MediaRequestEntity, Long> {

    /**
     * A request is identified by record + kind + scope. Sentinel-based scope columns (never null)
     * are what make this a single deterministic lookup — see MediaRequestScope.
     */
    Optional<MediaRequestEntity> findByRecordIdAndKindAndSeasonNumberAndEpisodeNumber(
            Long recordId, MediaRequestKind kind, int seasonNumber, int episodeNumber);

    long countByStatus(MediaRequestStatus status);

    @Query("""
           SELECT r FROM MediaRequestEntity r
           LEFT JOIN FETCH r.voterUserIds
           WHERE r.status = :status
           ORDER BY r.createdAt DESC
           """)
    List<MediaRequestEntity> findAllByStatusWithVoters(@Param("status") MediaRequestStatus status);

    @Query("""
           SELECT r FROM MediaRequestEntity r
           LEFT JOIN FETCH r.voterUserIds
           ORDER BY r.createdAt DESC
           """)
    List<MediaRequestEntity> findAllWithVoters();

    /** Every pending request on one record — whole-title, per-season and per-episode alike. */
    @Query("""
           SELECT r FROM MediaRequestEntity r
           LEFT JOIN FETCH r.voterUserIds
           WHERE r.recordId = :recordId AND r.status = 'PENDING'
           ORDER BY r.seasonNumber, r.episodeNumber
           """)
    List<MediaRequestEntity> findPendingForRecordWithVoters(@Param("recordId") Long recordId);

    /**
     * Pending requests the given user has voted for. Returns entities rather than a constructor
     * projection because the scope sentinels have to be normalised to nulls on the way out, which
     * a JPQL projection can't do.
     */
    @Query("""
           SELECT r FROM MediaRequestEntity r
           JOIN r.voterUserIds v
           WHERE v = :userId AND r.status = 'PENDING'
           """)
    List<MediaRequestEntity> findPendingVotedBy(@Param("userId") Long userId);
}
