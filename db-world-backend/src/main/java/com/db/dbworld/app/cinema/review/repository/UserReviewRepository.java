package com.db.dbworld.app.cinema.review.repository;

import com.db.dbworld.app.cinema.review.entity.UserReviewEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserReviewRepository extends JpaRepository<UserReviewEntity, String> {

    List<UserReviewEntity> findByRecordIdOrderByCreatedAtDesc(Long recordId);

    Optional<UserReviewEntity> findByUserIdAndRecordId(Long userId, Long recordId);

    boolean existsByUserIdAndRecordId(Long userId, Long recordId);

    /**
     * Find users who have reviewed this record (other than the actor).
     * Used to notify peers when a new review lands on a title they also reviewed.
     */
    @Query("SELECT DISTINCT r.userId FROM UserReviewEntity r " +
           "WHERE r.recordId = :recordId AND r.userId != :actorId")
    List<Long> findOtherReviewerIdsForRecord(
            @Param("actorId") Long actorId,
            @Param("recordId") Long recordId);
}
