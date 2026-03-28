package com.db.dbworld.payloads.user;

import com.db.dbworld.audit.activity.entity.UserActivityLogEntity;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class UserActivityLogDto {
    private Long id;
    private String username;
    private String method;
    private String uri;
    private String query;
    private String requestBody;
    private String ip;
    private String userAgent;
    private int status;
    private long duration;
    private String requestId;
    private LocalDateTime timestamp;
    private Long userId; // Optional: include user ID if needed

    // Constructor from Entity
    public UserActivityLogDto(UserActivityLogEntity entity) {
        this.id = entity.getId();
        this.username = entity.getUser() != null ? entity.getUser().getEmail() : "Anonymous";
        this.method = entity.getMethod();
        this.uri = entity.getUri();
        this.query = entity.getQuery();
        this.requestBody = entity.getRequestBody();
        this.ip = entity.getIp();
        this.userAgent = entity.getUserAgent();
        this.status = entity.getStatus();
        this.duration = entity.getDuration();
        this.requestId = entity.getRequestId();
        this.timestamp = entity.getTimestamp();
        this.userId = entity.getUser() != null ? entity.getUser().getUserId() : null;
    }

}
