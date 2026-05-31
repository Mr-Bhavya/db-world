package com.db.dbworld.app.cinema.mediarequest.dto;

import com.db.dbworld.app.cinema.common.dto.VoterSummary;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestKind;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

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
    private List<VoterSummary> voters;
    private Instant createdAt;
    private Instant fulfilledAt;
    private String fulfilledByUsername;
    private String dismissReason;
}
