package com.db.dbworld.app.cinema.mediarequest.dto;

import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestEntity;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestKind;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestScope;

/**
 * One pending request on a record, as the record detail page needs it: which scope, how many
 * people are behind it, and whether the caller is one of them. A series can carry a whole-title
 * request plus one per season plus one per missing episode, so this comes back as a list and
 * the client matches by scope.
 */
public record MediaRequestScopeSummary(
        Long requestId,
        MediaRequestKind kind,
        Integer season,
        Integer episode,
        String scopeLabel,
        int voteCount,
        boolean hasMyVote
) {
    public static MediaRequestScopeSummary from(MediaRequestEntity e, Long callerUserId) {
        MediaRequestScope scope = e.scope();
        var voters = e.getVoterUserIds();
        return new MediaRequestScopeSummary(
                e.getId(),
                e.getKind(),
                scope.seasonOrNull(),
                scope.episodeOrNull(),
                scope.label(),
                voters == null ? 0 : voters.size(),
                callerUserId != null && voters != null && voters.contains(callerUserId)
        );
    }
}
