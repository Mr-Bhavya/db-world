package com.db.dbworld.app.cinema.catalogrequest.service.impl;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalogrequest.dto.CatalogIngestRequestDto;
import com.db.dbworld.app.cinema.catalogrequest.dto.CatalogIngestRequestSubmission;
import com.db.dbworld.app.cinema.catalogrequest.dto.CatalogIngestRequestVoteResponse;
import com.db.dbworld.app.cinema.catalogrequest.dto.MyCatalogIngestRequestEntry;
import com.db.dbworld.app.cinema.catalogrequest.entity.CatalogIngestRequestEntity;
import com.db.dbworld.app.cinema.catalogrequest.entity.CatalogIngestRequestStatus;
import com.db.dbworld.app.cinema.catalogrequest.repository.CatalogIngestRequestRepository;
import com.db.dbworld.app.cinema.catalogrequest.service.CatalogIngestRequestService;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.notification.service.UserNotificationService;
import com.db.dbworld.app.cinema.tmdb.ingestion.TmdbIngestionService;
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
    private final TmdbIngestionService ingestionService;
    private final UserNotificationService notifService;

    @Override
    @Transactional
    public CatalogIngestRequestVoteResponse toggleVote(CatalogIngestRequestSubmission body, Long userId) {
        if (body == null || body.getTmdbId() == null || body.getMediaType() == null) {
            throw new IllegalArgumentException("tmdbId and mediaType are required");
        }

        // If a record with this TMDB id already exists in the catalog, the user should
        // request files via the regular media-request flow on that record, not via the
        // catalog ingest queue — reject early to keep the queues clean.
        if (recordRepo.findByTmdb_Id(body.getTmdbId()).isPresent()) {
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
        CatalogIngestRequestEntity request = requestRepo.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("CatalogIngestRequest", "id", requestId));

        if (request.getStatus() == CatalogIngestRequestStatus.INGESTED) {
            return toDto(request, adminUserId);
        }

        // Drive the existing TMDB ingestion pipeline. ingestMovie/ingestTvSeries creates
        // both the TMDB entity and its linked RecordEntity in the catalog.
        Long tmdbId = request.getTmdbId();
        if (request.getMediaType() == RecordType.MOVIE) {
            ingestionService.ingestMovie(tmdbId);
        } else {
            ingestionService.ingestTvSeries(tmdbId);
        }

        Long createdRecordId = recordRepo.findByTmdb_Id(tmdbId)
                .map(RecordEntity::getId)
                .orElseThrow(() -> new IllegalStateException(
                        "TMDB ingest finished but no RecordEntity was found for tmdbId=" + tmdbId));

        request.setStatus(CatalogIngestRequestStatus.INGESTED);
        request.setIngestedAt(Instant.now());
        request.setIngestedByUserId(adminUserId);
        request.setIngestedByUsername(adminUsername);
        request.setCreatedRecordId(createdRecordId);
        requestRepo.save(request);

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

    @Override
    @Transactional
    public CatalogIngestRequestDto dismiss(Long requestId, String reason, Long adminUserId, String adminUsername) {
        CatalogIngestRequestEntity request = requestRepo.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("CatalogIngestRequest", "id", requestId));

        if (request.getStatus() == CatalogIngestRequestStatus.DISMISSED) {
            return toDto(request, adminUserId);
        }

        String trimmed = trimmedOrNull(reason);
        request.setStatus(CatalogIngestRequestStatus.DISMISSED);
        request.setDismissReason(trimmed);
        requestRepo.save(request);

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
        CatalogIngestRequestEntity request = requestRepo.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("CatalogIngestRequest", "id", requestId));
        request.setStatus(CatalogIngestRequestStatus.PENDING);
        request.setIngestedAt(null);
        request.setIngestedByUserId(null);
        request.setIngestedByUsername(null);
        request.setCreatedRecordId(null);
        request.setDismissReason(null);
        requestRepo.save(request);
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
