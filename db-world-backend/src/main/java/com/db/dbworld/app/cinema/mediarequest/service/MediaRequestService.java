package com.db.dbworld.app.cinema.mediarequest.service;

import com.db.dbworld.app.cinema.mediarequest.dto.MediaRequestDto;
import com.db.dbworld.app.cinema.mediarequest.dto.MediaRequestVoteResponse;
import com.db.dbworld.app.cinema.mediarequest.dto.MyMediaRequestEntry;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestKind;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestStatus;

import java.util.List;

public interface MediaRequestService {

    /** Toggle the caller's vote on a request of the given kind for this record. */
    MediaRequestVoteResponse toggleVote(Long recordId, Long userId, MediaRequestKind kind);

    /** Pending {recordId, kind} pairs the caller has voted for. */
    List<MyMediaRequestEntry> getMyPendingRequests(Long userId);

    /** Admin: list requests filtered by status (or all if null). */
    List<MediaRequestDto> listAll(MediaRequestStatus status, Long callerUserId);

    /** Admin: mark a request fulfilled and notify all voters. */
    MediaRequestDto fulfill(Long requestId, Long adminUserId, String adminUsername);

    /** Admin: dismiss a request without notifying. */
    MediaRequestDto dismiss(Long requestId);

    /**
     * Admin: reopen a fulfilled or dismissed request — flips status back to PENDING
     * and clears the fulfilled-by metadata. Voters are preserved so the original
     * demand survives an accidental fulfill/dismiss.
     */
    MediaRequestDto reopen(Long requestId);
}
