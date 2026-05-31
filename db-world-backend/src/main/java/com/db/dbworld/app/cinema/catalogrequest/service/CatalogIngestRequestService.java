package com.db.dbworld.app.cinema.catalogrequest.service;

import com.db.dbworld.app.cinema.catalogrequest.dto.CatalogIngestRequestDto;
import com.db.dbworld.app.cinema.catalogrequest.dto.CatalogIngestRequestSubmission;
import com.db.dbworld.app.cinema.catalogrequest.dto.CatalogIngestRequestVoteResponse;
import com.db.dbworld.app.cinema.catalogrequest.dto.MyCatalogIngestRequestEntry;
import com.db.dbworld.app.cinema.catalogrequest.entity.CatalogIngestRequestStatus;

import java.util.List;

public interface CatalogIngestRequestService {

    /**
     * Toggle the caller's vote on a catalog ingest request for the given TMDB title.
     * Creates the request from the submission snapshot if it doesn't yet exist.
     */
    CatalogIngestRequestVoteResponse toggleVote(CatalogIngestRequestSubmission body, Long userId);

    /** Pending (tmdbId, mediaType) pairs the caller has voted for. */
    List<MyCatalogIngestRequestEntry> getMyPendingRequests(Long userId);

    /** Admin: list catalog ingest requests filtered by status (or all if null). */
    List<CatalogIngestRequestDto> listAll(CatalogIngestRequestStatus status, Long callerUserId);

    /** Admin: cheap counter for the sidebar/dashboard pending-request badge. */
    long countByStatus(CatalogIngestRequestStatus status);

    /**
     * Admin: ingest the TMDB title into the catalog. Calls TmdbIngestionService, marks
     * the request INGESTED, and notifies voters with a link to the newly created record.
     */
    CatalogIngestRequestDto ingest(Long requestId, Long adminUserId, String adminUsername);

    /**
     * Admin: mark the request fulfilled without ingesting TMDB metadata. Used when the
     * admin has uploaded the file directly to the unassigned bucket — voters get a
     * notification pointing them at search ("the file is now searchable"). No record
     * is created and no media-files carryover request is opened.
     */
    CatalogIngestRequestDto markFulfilledNoIngest(Long requestId, Long adminUserId, String adminUsername);

    /** Admin: dismiss the request and notify voters with an optional reason. */
    CatalogIngestRequestDto dismiss(Long requestId, String reason, Long adminUserId, String adminUsername);

    /** Admin: undo ingest/dismiss — flip back to PENDING, preserving voters. */
    CatalogIngestRequestDto reopen(Long requestId);
}
