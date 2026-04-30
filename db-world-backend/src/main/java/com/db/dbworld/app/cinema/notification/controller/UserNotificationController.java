package com.db.dbworld.app.cinema.notification.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.notification.dto.UserNotificationDto;
import com.db.dbworld.app.cinema.notification.service.UserNotificationService;
import com.db.dbworld.core.context.UserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class UserNotificationController {

    private final UserNotificationService notifService;
    private final UserContext             userContext;

    /** GET /api/notifications?limit=30 */
    @GetMapping
    public ApiResponse<List<UserNotificationDto>> getNotifications(
            @RequestParam(defaultValue = "30") int limit
    ) {
        return ApiResponse.success(notifService.getForUser(userContext.userId(), limit));
    }

    /** GET /api/notifications/unread-count  →  { "count": N } */
    @GetMapping("/unread-count")
    public ApiResponse<Map<String, Long>> getUnreadCount() {
        return ApiResponse.success(Map.of("count", notifService.getUnreadCount(userContext.userId())));
    }

    /** PUT /api/notifications/mark-read  — marks all unread for the caller as read */
    @PutMapping("/mark-read")
    public ApiResponse<Void> markAllRead() {
        notifService.markAllRead(userContext.userId());
        return ApiResponse.success("Marked all as read");
    }
}
