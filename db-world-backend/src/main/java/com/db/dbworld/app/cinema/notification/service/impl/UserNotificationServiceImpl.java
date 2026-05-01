package com.db.dbworld.app.cinema.notification.service.impl;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.notification.dto.UserNotificationDto;
import com.db.dbworld.app.cinema.notification.entity.UserNotificationEntity;
import com.db.dbworld.app.cinema.notification.repository.UserNotificationRepository;
import com.db.dbworld.app.cinema.notification.service.UserNotificationService;
import com.db.dbworld.app.cinema.review.repository.UserReviewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserNotificationServiceImpl implements UserNotificationService {

    private final UserNotificationRepository notifRepo;
    private final UserReviewRepository       reviewRepo;
    private final RecordRepository           recordRepo;

    @Override
    @Transactional
    public void createReviewNotifications(Long actorUserId, String actorUsername, Long recordId) {
        if (notifRepo.existsByActorUserIdAndRecordId(actorUserId, recordId)) return;

        RecordEntity record = recordRepo.findById(recordId).orElse(null);
        if (record == null) {
            log.warn("createReviewNotifications: record {} not found, skipping", recordId);
            return;
        }

        List<Long> recipients = reviewRepo.findReviewerIdsExcludingRecordAndActor(actorUserId, recordId);
        if (recipients.isEmpty()) return;

        String title      = record.getName();
        String recordType = record.getType().name();

        List<UserNotificationEntity> notifications = recipients.stream()
                .map(recipientId -> UserNotificationEntity.builder()
                        .recipientUserId(recipientId)
                        .actorUserId(actorUserId)
                        .actorUsername(actorUsername)
                        .recordId(recordId)
                        .recordTitle(title)
                        .recordType(recordType)
                        .read(false)
                        .build())
                .toList();

        notifRepo.saveAll(notifications);
        log.info("Created {} review notifications for record {} by user {}", notifications.size(), recordId, actorUserId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserNotificationDto> getForUser(Long userId, int limit) {
        return notifRepo.findByRecipientUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, limit))
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public long getUnreadCount(Long userId) {
        return notifRepo.countByRecipientUserIdAndReadFalse(userId);
    }

    @Override
    @Transactional
    public void markAllRead(Long userId) {
        notifRepo.markAllReadByRecipientUserId(userId);
    }

    private UserNotificationDto toDto(UserNotificationEntity e) {
        return UserNotificationDto.builder()
                .id(e.getId())
                .actorUsername(e.getActorUsername())
                .recordId(e.getRecordId())
                .recordTitle(e.getRecordTitle())
                .recordType(e.getRecordType())
                .read(e.isRead())
                .createdAt(e.getCreatedAt())
                .build();
    }
}
