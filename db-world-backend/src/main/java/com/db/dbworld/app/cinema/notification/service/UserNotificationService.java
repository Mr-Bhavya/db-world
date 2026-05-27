package com.db.dbworld.app.cinema.notification.service;

import com.db.dbworld.app.cinema.notification.dto.UserNotificationDto;
import java.util.Collection;
import java.util.List;

public interface UserNotificationService {
    void createReviewNotifications(Long actorUserId, String actorUsername, Long recordId);

    /**
     * Notify a set of users that a media-file request they voted for has been fulfilled.
     * The admin who fulfilled the request becomes the "actor" so the existing schema fits.
     */
    void createRequestFulfilledNotifications(
            Long actorUserId,
            String actorUsername,
            Long recordId,
            String recordTitle,
            String recordType,
            Collection<Long> recipientUserIds
    );

    List<UserNotificationDto> getForUser(Long userId, int limit);
    long getUnreadCount(Long userId);
    void markAllRead(Long userId);
}
