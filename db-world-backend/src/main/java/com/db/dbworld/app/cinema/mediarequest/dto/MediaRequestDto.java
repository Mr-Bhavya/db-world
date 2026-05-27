package com.db.dbworld.app.cinema.mediarequest.dto;

import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestKind;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class MediaRequestDto {
    private Long id;
    private Long recordId;
    private String recordTitle;
    private String recordType;
    private MediaRequestKind kind;
    private MediaRequestStatus status;
    private int voteCount;
    private boolean hasMyVote;
    private Instant createdAt;
    private Instant fulfilledAt;
    private String fulfilledByUsername;
}
