package com.db.dbworld.app.cinema.mediarequest.service;

import com.db.dbworld.app.cinema.mediarequest.dto.MediaRequestDto;
import com.db.dbworld.app.cinema.mediarequest.dto.MediaRequestScopeSummary;
import com.db.dbworld.app.cinema.mediarequest.dto.MediaRequestVoteResponse;
import com.db.dbworld.app.cinema.mediarequest.dto.MyMediaRequestEntry;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestKind;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestStatus;

import java.util.List;

public interface MediaRequestService {

    /**
     * Toggle the caller's vote on a request for this record, kind and scope.
     *
     * @param season  season the request is about, or {@code null} for the whole title
     * @param episode episode within {@code season}, or {@code null} for the whole season.
     *                Only meaningful for a TV series; an episode without a season is rejected.
     */
    MediaRequestVoteResponse toggleVote(Long recordId, Long userId, MediaRequestKind kind,
                                        Integer season, Integer episode);

    /** Pending requests the caller has voted for, across the catalogue. */
    List<MyMediaRequestEntry> getMyPendingRequests(Long userId);

    /** Every pending request on one record, with vote counts — what the detail page renders from. */
    List<MediaRequestScopeSummary> listPendingForRecord(Long recordId, Long callerUserId);

    /** Admin: list requests filtered by status (or all if null). */
    List<MediaRequestDto> listAll(MediaRequestStatus status, Long callerUserId);

    /** Admin: cheap counter for the sidebar/dashboard pending-request badge. */
    long countByStatus(MediaRequestStatus status);

    /** Admin: mark a request fulfilled and notify all voters. */
    MediaRequestDto fulfill(Long requestId, Long adminUserId, String adminUsername);

    /**
     * Admin: dismiss a request and notify all voters with an optional reason
     * (e.g. "Not available in higher quality"). Pass {@code null} or blank to
     * dismiss with no explanatory message.
     */
    MediaRequestDto dismiss(Long requestId, String reason, Long adminUserId, String adminUsername);

    /**
     * Admin: reopen a fulfilled or dismissed request — flips status back to PENDING
     * and clears the fulfilled-by metadata. Voters are preserved so the original
     * demand survives an accidental fulfill/dismiss.
     */
    MediaRequestDto reopen(Long requestId);
}
