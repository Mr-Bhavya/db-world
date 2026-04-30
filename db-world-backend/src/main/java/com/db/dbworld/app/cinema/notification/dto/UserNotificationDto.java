package com.db.dbworld.app.cinema.notification.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;

@Data
@Builder
public class UserNotificationDto {
    private Long    id;
    private String  actorUsername;
    private Long    recordId;
    private String  recordTitle;
    private String  recordType;
    private boolean read;
    private Instant createdAt;
}
