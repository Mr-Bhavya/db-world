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

    /**
     * Notify voters that their media-file request was dismissed by an admin. The optional
     * {@code reason} is stored on the notification as a human-readable explanation
     * (e.g. "Not available in higher quality"); voters see it on the notification panel
     * and the next-login toast.
     */
    void createRequestDismissedNotifications(
            Long actorUserId,
            String actorUsername,
            Long recordId,
            String recordTitle,
            String recordType,
            String reason,
            Collection<Long> recipientUserIds
    );

    /**
     * Notify voters that the TMDB title they requested has been ingested into the
     * catalog. The notification deep-links to the newly created record so the user
     * can immediately browse or request media files.
     */
    void createCatalogIngestedNotifications(
            Long actorUserId,
            String actorUsername,
            Long createdRecordId,
            String recordTitle,
            String recordType,
            Collection<Long> recipientUserIds
    );

    List<UserNotificationDto> getForUser(Long userId, int limit);
    long getUnreadCount(Long userId);
    void markAllRead(Long userId);
}
