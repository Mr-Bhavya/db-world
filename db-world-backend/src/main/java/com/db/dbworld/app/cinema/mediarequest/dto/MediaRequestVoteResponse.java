package com.db.dbworld.app.cinema.mediarequest.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class MediaRequestVoteResponse {
    private Long recordId;
    private int voteCount;
    private boolean hasMyVote;
}
