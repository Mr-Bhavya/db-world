package com.db.dbworld.app.cinema.review.repository;

import com.db.dbworld.app.cinema.review.entity.UserReviewEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserReviewRepository extends JpaRepository<UserReviewEntity, String> {

    List<UserReviewEntity> findByRecordIdOrderByCreatedAtDesc(Long recordId);

    Optional<UserReviewEntity> findByUserIdAndRecordId(Long userId, Long recordId);

    boolean existsByUserIdAndRecordId(Long userId, Long recordId);
}
