package com.db.dbworld.app.cinema.notification.service;

import com.db.dbworld.app.cinema.notification.dto.UserNotificationDto;
import java.util.List;

public interface UserNotificationService {
    void createReviewNotifications(Long actorUserId, String actorUsername, Long recordId);
    List<UserNotificationDto> getForUser(Long userId, int limit);
    long getUnreadCount(Long userId);
    void markAllRead(Long userId);
}
