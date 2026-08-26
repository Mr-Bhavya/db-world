package com.db.dbworld.app.cinema.mediarequest.dto;

import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestKind;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestScope;

/**
 * Result of toggling a vote. Echoes the scope back so an optimistic client can key the
 * response to the exact button that was pressed (a page can hold dozens of them).
 */
public record MediaRequestVoteResponse(
        Long recordId,
        MediaRequestKind kind,
        Integer season,
        Integer episode,
        String scopeLabel,
        int voteCount,
        boolean hasMyVote
) {
    public static MediaRequestVoteResponse of(Long recordId, MediaRequestKind kind, MediaRequestScope scope,
                                              int voteCount, boolean hasMyVote) {
        return new MediaRequestVoteResponse(
                recordId, kind, scope.seasonOrNull(), scope.episodeOrNull(), scope.label(), voteCount, hasMyVote);
    }
}
