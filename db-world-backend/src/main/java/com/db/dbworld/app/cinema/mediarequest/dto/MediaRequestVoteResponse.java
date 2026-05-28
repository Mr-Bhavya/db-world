package com.db.dbworld.app.cinema.mediarequest.dto;

import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestKind;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class MediaRequestVoteResponse {
    private Long recordId;
    private MediaRequestKind kind;
    private int voteCount;
    private boolean hasMyVote;
}
