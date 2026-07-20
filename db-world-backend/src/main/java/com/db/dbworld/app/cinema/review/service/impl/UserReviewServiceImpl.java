package com.db.dbworld.app.cinema.review.service.impl;

import com.db.dbworld.app.cinema.review.dto.UserReviewDto;
import com.db.dbworld.app.cinema.review.dto.UserReviewRequest;
import com.db.dbworld.app.cinema.review.entity.UserReviewEntity;
import com.db.dbworld.app.cinema.review.repository.UserReviewRepository;
import com.db.dbworld.app.cinema.review.service.UserReviewService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Log4j2
@Service
@RequiredArgsConstructor
public class UserReviewServiceImpl implements UserReviewService {

    private final UserReviewRepository repo;

    @Override
    @Transactional
    public UserReviewDto upsert(Long userId, String username, Long recordId, UserReviewRequest req) {
        log.debug("upsert review: userId={}, recordId={}, rating={}", userId, recordId, req.getRating());
        UserReviewEntity entity = repo.findByUserIdAndRecordId(userId, recordId)
                .orElseGet(UserReviewEntity::new);
        boolean isNew = entity.getId() == null;

        entity.setUserId(userId);
        entity.setRecordId(recordId);
        entity.setUsername(username);
        entity.setRating(req.getRating());
        entity.setContent(req.getContent());

        UserReviewEntity saved = repo.save(entity);
        log.info("Review {}: id={}, userId={}, recordId={}, rating={}",
                isNew ? "submitted" : "updated", saved.getId(), userId, recordId, req.getRating());
        return toDto(saved, userId);
    }

    @Override
    @Transactional
    public void delete(Long userId, Long recordId) {
        log.debug("delete review: userId={}, recordId={}", userId, recordId);
        repo.findByUserIdAndRecordId(userId, recordId).ifPresent(e -> {
            repo.delete(e);
            log.info("Review deleted: id={}, userId={}, recordId={}", e.getId(), userId, recordId);
        });
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserReviewDto> getByRecord(Long recordId, Long callerId) {
        return repo.findByRecordIdOrderByCreatedAtDesc(recordId)
                .stream()
                .map(e -> toDto(e, callerId))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<UserReviewDto> getMine(Long userId, Long recordId) {
        return repo.findByUserIdAndRecordId(userId, recordId)
                .map(e -> toDto(e, userId));
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private UserReviewDto toDto(UserReviewEntity e, Long callerId) {
        return UserReviewDto.builder()
                .id(e.getId())
                .userId(e.getUserId())
                .recordId(e.getRecordId())
                .username(e.getUsername())
                .rating(e.getRating())
                .content(e.getContent())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .ownReview(callerId != null && callerId.equals(e.getUserId()))
                .build();
    }
}
