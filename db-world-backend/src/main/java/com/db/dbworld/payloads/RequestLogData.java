package com.db.dbworld.payloads;

import com.db.dbworld.core.user.entity.UserEntity;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RequestLogData {
    private final long userId;
    private final String userEmail;
    private final String method;
    private final String uri;
    private final String query;
    private final String ip;
    private final String userAgent;
    private final int status;
    private final long duration;
    private final String requestId;
    private final String requestBody;
    private final boolean shouldPersist;
    private final boolean isRequest;
}