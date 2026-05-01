package com.db.dbworld.app.cinema.review.service.impl;

import com.db.dbworld.app.cinema.review.dto.UserReviewDto;
import com.db.dbworld.app.cinema.review.dto.UserReviewRequest;
import com.db.dbworld.app.cinema.review.entity.UserReviewEntity;
import com.db.dbworld.app.cinema.review.repository.UserReviewRepository;
import com.db.dbworld.app.cinema.review.service.UserReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserReviewServiceImpl implements UserReviewService {

    private final UserReviewRepository repo;

    @Override
    @Transactional
    public UserReviewDto upsert(Long userId, String username, Long recordId, UserReviewRequest req) {
        UserReviewEntity entity = repo.findByUserIdAndRecordId(userId, recordId)
                .orElseGet(UserReviewEntity::new);

        entity.setUserId(userId);
        entity.setRecordId(recordId);
        entity.setUsername(username);
        entity.setRating(req.getRating());
        entity.setContent(req.getContent());

        return toDto(repo.save(entity), userId);
    }

    @Override
    @Transactional
    public void delete(Long userId, Long recordId) {
        repo.findByUserIdAndRecordId(userId, recordId).ifPresent(repo::delete);
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
