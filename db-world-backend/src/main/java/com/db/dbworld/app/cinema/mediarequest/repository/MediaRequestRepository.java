package com.db.dbworld.app.cinema.mediarequest.repository;

import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestEntity;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MediaRequestRepository extends JpaRepository<MediaRequestEntity, Long> {

    Optional<MediaRequestEntity> findByRecordId(Long recordId);

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

    @Query("""
           SELECT r.recordId FROM MediaRequestEntity r
           JOIN r.voterUserIds v
           WHERE v = :userId AND r.status = 'PENDING'
           """)
    List<Long> findPendingRecordIdsVotedBy(@Param("userId") Long userId);
}
