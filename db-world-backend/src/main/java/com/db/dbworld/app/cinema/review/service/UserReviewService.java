package com.db.dbworld.app.cinema.review.service;

import com.db.dbworld.app.cinema.review.dto.UserReviewDto;
import com.db.dbworld.app.cinema.review.dto.UserReviewRequest;

import java.util.List;
import java.util.Optional;

public interface UserReviewService {

    /** Submit or update (upsert) a review. Returns the saved review. */
    UserReviewDto upsert(Long userId, String username, Long recordId, UserReviewRequest request);

    /** Delete the caller's review for a record. No-op if none exists. */
    void delete(Long userId, Long recordId);

    /** All reviews for a record, newest first. */
    List<UserReviewDto> getByRecord(Long recordId, Long callerId);

    /** The caller's own review, if any. */
    Optional<UserReviewDto> getMine(Long userId, Long recordId);
}
