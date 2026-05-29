package com.db.dbworld.app.cinema.catalogrequest.service.impl;

import com.db.dbworld.app.cinema.catalog.dto.request.CreateRecordRequest;
import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalog.service.CatalogService;
import com.db.dbworld.app.cinema.catalogrequest.dto.CatalogIngestRequestDto;
import com.db.dbworld.app.cinema.catalogrequest.dto.CatalogIngestRequestSubmission;
import com.db.dbworld.app.cinema.catalogrequest.dto.CatalogIngestRequestVoteResponse;
import com.db.dbworld.app.cinema.catalogrequest.dto.MyCatalogIngestRequestEntry;
import com.db.dbworld.app.cinema.catalogrequest.entity.CatalogIngestRequestEntity;
import com.db.dbworld.app.cinema.catalogrequest.entity.CatalogIngestRequestStatus;
import com.db.dbworld.app.cinema.catalogrequest.repository.CatalogIngestRequestRepository;
import com.db.dbworld.app.cinema.catalogrequest.service.CatalogIngestRequestService;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestEntity;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestKind;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestStatus;
import com.db.dbworld.app.cinema.mediarequest.repository.MediaRequestRepository;
import com.db.dbworld.app.cinema.notification.service.UserNotificationService;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.app.cinema.tmdb.ingestion.TmdbIngestionService;
import com.db.dbworld.app.cinema.tmdb.repository.TmdbRepository;
import com.db.dbworld.core.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class CatalogIngestRequestServiceImpl implements CatalogIngestRequestService {

    private final CatalogIngestRequestRepository requestRepo;
    private final RecordRepository recordRepo;
    private final TmdbRepository tmdbRepo;
    private final CatalogService catalogService;
    private final MediaRequestRepository mediaRequestRepo;
    private final TmdbIngestionService ingestionService;
    private final UserNotificationService notifService;

    @Override
    @Transactional
    public CatalogIngestRequestVoteResponse toggleVote(CatalogIngestRequestSubmission body, Long userId) {
        if (body == null || body.getTmdbId() == null || body.getMediaType() == null) {
            log.warn("Catalog ingest vote rejected — missing tmdbId/mediaType for userId={}", userId);
            throw new IllegalArgumentException("tmdbId and mediaType are required");
        }
        log.debug("toggleVote: tmdbId={}, mediaType={}, userId={}", body.getTmdbId(), body.getMediaType(), userId);

        // If a record with this TMDB id already exists in the catalog, the user should
        // request files via the regular media-request flow on that record, not via the
        // catalog ingest queue — reject early to keep the queues clean.
        if (recordRepo.findByTmdb_Id(body.getTmdbId()).isPresent()) {
            log.warn("Catalog ingest vote rejected — title already in catalog: tmdbId={}, userId={}",
                    body.getTmdbId(), userId);
            throw new IllegalStateException("This title already exists in the catalog");
        }

        CatalogIngestRequestEntity request = requestRepo
                .findByTmdbIdAndMediaType(body.getTmdbId(), body.getMediaType())
                .orElse(null);

        if (request == null) {
            Set<Long> voters = new HashSet<>();
            voters.add(userId);

            request = CatalogIngestRequestEntity.builder()
                    .tmdbId(body.getTmdbId())
                    .mediaType(body.getMediaType())
                    .title(safeTitle(body.getTitle()))
                    .posterPath(body.getPosterPath())
                    .releaseYear(body.getReleaseYear())
                    .note(trimmedOrNull(body.getNote()))
                    .status(CatalogIngestRequestStatus.PENDING)
                    .voterUserIds(voters)
                    .build();
            request = requestRepo.save(request);
            log.info("Catalog ingest request created: id={}, tmdbId={}, mediaType={}, firstVoter={}",
                    request.getId(), body.getTmdbId(), body.getMediaType(), userId);

            return CatalogIngestRequestVoteResponse.builder()
                    .tmdbId(body.getTmdbId())
                    .mediaType(body.getMediaType())
                    .voteCount(1)
                    .hasMyVote(true)
                    .build();
        }

        // A new vote on a non-pending request re-opens it (admin's decision is overridden
        // by fresh demand). Voters reset so the next admin sees a clean count.
        if (request.getStatus() != CatalogIngestRequestStatus.PENDING) {
            log.info("Catalog ingest request reopened by fresh vote: id={}, tmdbId={}, prevStatus={}, userId={}",
                    request.getId(), body.getTmdbId(), request.getStatus(), userId);
            request.setStatus(CatalogIngestRequestStatus.PENDING);
            request.setIngestedAt(null);
            request.setIngestedByUserId(null);
            request.setIngestedByUsername(null);
            request.setCreatedRecordId(null);
            request.setDismissReason(null);
            request.getVoterUserIds().clear();
        }

        // Refresh display snapshot if the original was created with missing fields.
        if (body.getPosterPath() != null && request.getPosterPath() == null) {
            request.setPosterPath(body.getPosterPath());
        }
        if (body.getReleaseYear() != null && request.getReleaseYear() == null) {
            request.setReleaseYear(body.getReleaseYear());
        }

        boolean removed = request.getVoterUserIds().remove(userId);
        if (!removed) {
            request.getVoterUserIds().add(userId);
        }

        int voteCount = request.getVoterUserIds().size();
        boolean hasMyVote = !removed;

        if (voteCount == 0) {
            requestRepo.delete(request);
            log.info("Catalog ingest request pruned (no voters): id={}, tmdbId={}",
                    request.getId(), request.getTmdbId());
        } else {
            log.info("Catalog ingest vote {}: requestId={}, tmdbId={}, mediaType={}, userId={}, voteCount={}",
                    removed ? "removed" : "cast", request.getId(), request.getTmdbId(),
                    request.getMediaType(), userId, voteCount);
        }

        return CatalogIngestRequestVoteResponse.builder()
                .tmdbId(request.getTmdbId())
                .mediaType(request.getMediaType())
                .voteCount(voteCount)
                .hasMyVote(hasMyVote)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<MyCatalogIngestRequestEntry> getMyPendingRequests(Long userId) {
        return requestRepo.findPendingRequestsVotedBy(userId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CatalogIngestRequestDto> listAll(CatalogIngestRequestStatus status, Long callerUserId) {
        List<CatalogIngestRequestEntity> rows = (status == null)
                ? requestRepo.findAllWithVoters()
                : requestRepo.findAllByStatusWithVoters(status);
        return rows.stream().map(r -> toDto(r, callerUserId)).toList();
    }

    @Override
    @Transactional
    public CatalogIngestRequestDto ingest(Long requestId, Long adminUserId, String adminUsername) {
        log.debug("ingest: requestId={}, adminUserId={}", requestId, adminUserId);
        CatalogIngestRequestEntity request = requestRepo.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("CatalogIngestRequest", "id", requestId));

        if (request.getStatus() == CatalogIngestRequestStatus.INGESTED) {
            log.warn("Catalog ingest request already ingested, skipping: id={}", requestId);
            return toDto(request, adminUserId);
        }

        // Drive the existing catalog pipeline so both the TMDB metadata row AND the
        // catalog RecordEntity are created. Handles the recovery case where a previous
        // attempt left a stray TMDB entity without a paired RecordEntity.
        Long createdRecordId = resolveOrCreateRecord(request);

        // Carry voters over to a NEW_FILES media-files request on the freshly-created
        // record. A "new title" request is really an ask for media files — this keeps
        // their demand alive in the Media Requests queue so the admin's next step
        // (uploading files) is tracked and voters get a second notification when files
        // actually land.
        carryVotersToMediaRequest(createdRecordId, request);

        request.setStatus(CatalogIngestRequestStatus.INGESTED);
        request.setIngestedAt(Instant.now());
        request.setIngestedByUserId(adminUserId);
        request.setIngestedByUsername(adminUsername);
        request.setCreatedRecordId(createdRecordId);
        requestRepo.save(request);
        log.info("Catalog ingest request ingested: id={}, tmdbId={}, createdRecordId={}, voters={}, adminUserId={}",
                requestId, request.getTmdbId(), createdRecordId,
                request.getVoterUserIds() == null ? 0 : request.getVoterUserIds().size(),
                adminUserId);

        notifService.createCatalogIngestedNotifications(
                adminUserId,
                adminUsername,
                createdRecordId,
                request.getTitle(),
                request.getMediaType().name(),
                request.getVoterUserIds()
        );

        return toDto(request, adminUserId);
    }

    /**
     * Get a RecordEntity id for the requested TMDB title, creating one if needed.
     * Three states are tolerated:
     *   1. A RecordEntity already exists → return its id (idempotent re-ingest).
     *   2. Only a TMDB row exists (orphaned by a prior failed ingest) → wrap it in a
     *      RecordEntity so the catalog flow can proceed without re-fetching TMDB.
     *   3. Neither exists → delegate to CatalogService.createRecord which fetches
     *      TMDB metadata and creates both rows in one transaction.
     */
    private Long resolveOrCreateRecord(CatalogIngestRequestEntity request) {
        Long tmdbId = request.getTmdbId();

        var existing = recordRepo.findByTmdb_Id(tmdbId);
        if (existing.isPresent()) {
            return existing.get().getId();
        }

        if (tmdbRepo.existsById(tmdbId)) {
            // Recover from the prior bug: TMDB row exists but no RecordEntity. Re-wrap.
            TmdbEntity tmdb = tmdbRepo.findById(tmdbId)
                    .orElseThrow(() -> new IllegalStateException(
                            "TMDB row vanished mid-recovery for tmdbId=" + tmdbId));
            String title = tmdb.getTitle() != null && !tmdb.getTitle().isBlank()
                    ? tmdb.getTitle()
                    : safeTitle(request.getTitle());
            RecordEntity record = RecordEntity.builder()
                    .name(title)
                    .type(request.getMediaType())
                    .tmdb(tmdb)
                    .build();
            record = recordRepo.save(record);
            log.info("Recovered orphan TMDB row {} into RecordEntity {} for catalog ingest", tmdbId, record.getId());
            return record.getId();
        }

        CreateRecordRequest req = new CreateRecordRequest();
        req.setTmdbId(tmdbId);
        req.setType(request.getMediaType());
        return catalogService.createRecord(req).getId();
    }

    /**
     * Bridge catalog-ingest voters into the media-files queue. If a NEW_FILES
     * MediaRequest already exists for this record (e.g. someone separately
     * requested files), merge the voter sets — otherwise create a fresh PENDING
     * request seeded with the catalog-ingest voters.
     */
    private void carryVotersToMediaRequest(Long recordId, CatalogIngestRequestEntity src) {
        Set<Long> voters = src.getVoterUserIds();
        if (voters == null || voters.isEmpty()) return;

        RecordEntity record = recordRepo.findById(recordId)
                .orElseThrow(() -> new IllegalStateException(
                        "Record vanished mid-carryover for id=" + recordId));

        MediaRequestEntity mr = mediaRequestRepo
                .findByRecordIdAndKind(recordId, MediaRequestKind.NEW_FILES)
                .orElse(null);

        if (mr == null) {
            mr = MediaRequestEntity.builder()
                    .recordId(recordId)
                    .recordTitle(record.getName())
                    .recordType(record.getType().name())
                    .kind(MediaRequestKind.NEW_FILES)
                    .status(MediaRequestStatus.PENDING)
                    .voterUserIds(new HashSet<>(voters))
                    .build();
        } else {
            // Re-open if it was fulfilled/dismissed — fresh demand survives.
            if (mr.getStatus() != MediaRequestStatus.PENDING) {
                mr.setStatus(MediaRequestStatus.PENDING);
                mr.setFulfilledAt(null);
                mr.setFulfilledByUserId(null);
                mr.setFulfilledByUsername(null);
                mr.setDismissReason(null);
            }
            mr.getVoterUserIds().addAll(voters);
        }
        mediaRequestRepo.save(mr);
    }

    @Override
    @Transactional
    public CatalogIngestRequestDto markFulfilledNoIngest(Long requestId, Long adminUserId, String adminUsername) {
        log.debug("markFulfilledNoIngest: requestId={}, adminUserId={}", requestId, adminUserId);
        CatalogIngestRequestEntity request = requestRepo.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("CatalogIngestRequest", "id", requestId));

        if (request.getStatus() == CatalogIngestRequestStatus.INGESTED) {
            log.warn("Catalog ingest request already ingested, skipping markFulfilledNoIngest: id={}", requestId);
            return toDto(request, adminUserId);
        }

        // Reuse the INGESTED status so the row leaves the pending queue, but leave
        // createdRecordId null — the frontend knows this means "fulfilled without a
        // record, find via search".
        request.setStatus(CatalogIngestRequestStatus.INGESTED);
        request.setIngestedAt(Instant.now());
        request.setIngestedByUserId(adminUserId);
        request.setIngestedByUsername(adminUsername);
        request.setCreatedRecordId(null);
        requestRepo.save(request);
        log.info("Catalog ingest request fulfilled by search (no-ingest): id={}, tmdbId={}, voters={}, adminUserId={}",
                requestId, request.getTmdbId(),
                request.getVoterUserIds() == null ? 0 : request.getVoterUserIds().size(),
                adminUserId);

        notifService.createCatalogFulfilledBySearchNotifications(
                adminUserId,
                adminUsername,
                request.getTitle(),
                request.getMediaType().name(),
                request.getVoterUserIds()
        );

        return toDto(request, adminUserId);
    }

    @Override
    @Transactional
    public CatalogIngestRequestDto dismiss(Long requestId, String reason, Long adminUserId, String adminUsername) {
        log.debug("dismiss: requestId={}, adminUserId={}", requestId, adminUserId);
        CatalogIngestRequestEntity request = requestRepo.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("CatalogIngestRequest", "id", requestId));

        if (request.getStatus() == CatalogIngestRequestStatus.DISMISSED) {
            log.warn("Catalog ingest request already dismissed, skipping: id={}", requestId);
            return toDto(request, adminUserId);
        }

        String trimmed = trimmedOrNull(reason);
        request.setStatus(CatalogIngestRequestStatus.DISMISSED);
        request.setDismissReason(trimmed);
        requestRepo.save(request);
        log.info("Catalog ingest request dismissed: id={}, tmdbId={}, voters={}, hasReason={}, adminUserId={}",
                requestId, request.getTmdbId(),
                request.getVoterUserIds() == null ? 0 : request.getVoterUserIds().size(),
                trimmed != null, adminUserId);

        // Reuse the existing REQUEST_DISMISSED type — voters see the same UI in the
        // notification panel and a warning-coloured toast on next login.
        // We don't have a recordId yet (the title was never ingested), so we pass 0L
        // as a sentinel. The notification panel renders the message + title without
        // requiring a working route.
        notifService.createRequestDismissedNotifications(
                adminUserId,
                adminUsername,
                0L,
                request.getTitle(),
                request.getMediaType().name(),
                trimmed,
                request.getVoterUserIds()
        );

        return toDto(request, adminUserId);
    }

    @Override
    @Transactional
    public CatalogIngestRequestDto reopen(Long requestId) {
        log.debug("reopen: requestId={}", requestId);
        CatalogIngestRequestEntity request = requestRepo.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("CatalogIngestRequest", "id", requestId));
        CatalogIngestRequestStatus prev = request.getStatus();
        request.setStatus(CatalogIngestRequestStatus.PENDING);
        request.setIngestedAt(null);
        request.setIngestedByUserId(null);
        request.setIngestedByUsername(null);
        request.setCreatedRecordId(null);
        request.setDismissReason(null);
        requestRepo.save(request);
        log.info("Catalog ingest request reopened by admin: id={}, prevStatus={}", requestId, prev);
        return toDto(request, null);
    }

    private CatalogIngestRequestDto toDto(CatalogIngestRequestEntity e, Long callerUserId) {
        Set<Long> voters = e.getVoterUserIds();
        return CatalogIngestRequestDto.builder()
                .id(e.getId())
                .tmdbId(e.getTmdbId())
                .mediaType(e.getMediaType())
                .title(e.getTitle())
                .posterPath(e.getPosterPath())
                .releaseYear(e.getReleaseYear())
                .note(e.getNote())
                .status(e.getStatus())
                .voteCount(voters == null ? 0 : voters.size())
                .hasMyVote(callerUserId != null && voters != null && voters.contains(callerUserId))
                .createdAt(e.getCreatedAt())
                .ingestedAt(e.getIngestedAt())
                .ingestedByUsername(e.getIngestedByUsername())
                .createdRecordId(e.getCreatedRecordId())
                .dismissReason(e.getDismissReason())
                .build();
    }

    private static String safeTitle(String raw) {
        if (raw == null || raw.isBlank()) return "Untitled";
        return raw.length() > 300 ? raw.substring(0, 300) : raw;
    }

    private static String trimmedOrNull(String raw) {
        if (raw == null) return null;
        String t = raw.trim();
        return t.isEmpty() ? null : t;
    }
}
