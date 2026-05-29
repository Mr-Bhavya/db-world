package com.db.dbworld.app.cinema.mediarequest.service.impl;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.mediarequest.dto.MediaRequestDto;
import com.db.dbworld.app.cinema.mediarequest.dto.MediaRequestVoteResponse;
import com.db.dbworld.app.cinema.mediarequest.dto.MyMediaRequestEntry;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestEntity;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestKind;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestStatus;
import com.db.dbworld.app.cinema.mediarequest.repository.MediaRequestRepository;
import com.db.dbworld.app.cinema.mediarequest.service.MediaRequestService;
import com.db.dbworld.app.cinema.notification.service.UserNotificationService;
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
public class MediaRequestServiceImpl implements MediaRequestService {

    private final MediaRequestRepository requestRepo;
    private final RecordRepository recordRepo;
    private final UserNotificationService notifService;

    @Override
    @Transactional
    public MediaRequestVoteResponse toggleVote(Long recordId, Long userId, MediaRequestKind kindIn) {
        MediaRequestKind kind = kindIn == null ? MediaRequestKind.NEW_FILES : kindIn;
        log.debug("toggleVote: recordId={}, userId={}, kind={}", recordId, userId, kind);
        MediaRequestEntity request = requestRepo.findByRecordIdAndKind(recordId, kind).orElse(null);

        if (request == null) {
            RecordEntity record = recordRepo.findById(recordId)
                    .orElseThrow(() -> new ResourceNotFoundException("Record", "id", recordId));

            Set<Long> voters = new HashSet<>();
            voters.add(userId);

            request = MediaRequestEntity.builder()
                    .recordId(recordId)
                    .recordTitle(record.getName())
                    .recordType(record.getType().name())
                    .kind(kind)
                    .status(MediaRequestStatus.PENDING)
                    .voterUserIds(voters)
                    .build();
            request = requestRepo.save(request);
            log.info("Media request created: id={}, recordId={}, kind={}, firstVoter={}",
                    request.getId(), recordId, kind, userId);

            return MediaRequestVoteResponse.builder()
                    .recordId(recordId)
                    .kind(kind)
                    .voteCount(1)
                    .hasMyVote(true)
                    .build();
        }

        // Fulfilled/dismissed → a fresh vote re-opens it. Old voters are reset so the
        // new PENDING run starts clean; admins get a new aggregated count.
        if (request.getStatus() != MediaRequestStatus.PENDING) {
            log.info("Media request reopened by fresh vote: id={}, recordId={}, kind={}, prevStatus={}, userId={}",
                    request.getId(), recordId, kind, request.getStatus(), userId);
            request.setStatus(MediaRequestStatus.PENDING);
            request.setFulfilledAt(null);
            request.setFulfilledByUserId(null);
            request.setFulfilledByUsername(null);
            request.getVoterUserIds().clear();
        }

        boolean removed = request.getVoterUserIds().remove(userId);
        if (!removed) {
            request.getVoterUserIds().add(userId);
        }

        int voteCount = request.getVoterUserIds().size();
        boolean hasMyVote = !removed;

        // If everyone unvoted, prune the empty request to keep the queue clean.
        if (voteCount == 0) {
            requestRepo.delete(request);
            log.info("Media request pruned (no voters): id={}, recordId={}, kind={}",
                    request.getId(), recordId, kind);
        } else {
            log.info("Media request vote {}: requestId={}, recordId={}, kind={}, userId={}, voteCount={}",
                    removed ? "removed" : "cast", request.getId(), recordId, kind, userId, voteCount);
        }

        return MediaRequestVoteResponse.builder()
                .recordId(recordId)
                .kind(kind)
                .voteCount(voteCount)
                .hasMyVote(hasMyVote)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<MyMediaRequestEntry> getMyPendingRequests(Long userId) {
        return requestRepo.findPendingRequestsVotedBy(userId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MediaRequestDto> listAll(MediaRequestStatus status, Long callerUserId) {
        List<MediaRequestEntity> rows = (status == null)
                ? requestRepo.findAllWithVoters()
                : requestRepo.findAllByStatusWithVoters(status);
        return rows.stream().map(r -> toDto(r, callerUserId)).toList();
    }

    @Override
    @Transactional
    public MediaRequestDto fulfill(Long requestId, Long adminUserId, String adminUsername) {
        log.debug("fulfill: requestId={}, adminUserId={}", requestId, adminUserId);
        MediaRequestEntity request = requestRepo.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("MediaRequest", "id", requestId));

        if (request.getStatus() == MediaRequestStatus.FULFILLED) {
            log.warn("Media request already fulfilled, skipping: id={}", requestId);
            return toDto(request, adminUserId);
        }

        request.setStatus(MediaRequestStatus.FULFILLED);
        request.setFulfilledAt(Instant.now());
        request.setFulfilledByUserId(adminUserId);
        request.setFulfilledByUsername(adminUsername);
        requestRepo.save(request);
        log.info("Media request fulfilled: id={}, recordId={}, voters={}, adminUserId={}",
                requestId, request.getRecordId(),
                request.getVoterUserIds() == null ? 0 : request.getVoterUserIds().size(),
                adminUserId);

        notifService.createRequestFulfilledNotifications(
                adminUserId,
                adminUsername,
                request.getRecordId(),
                request.getRecordTitle(),
                request.getRecordType(),
                request.getVoterUserIds()
        );

        return toDto(request, adminUserId);
    }

    @Override
    @Transactional
    public MediaRequestDto dismiss(Long requestId, String reason, Long adminUserId, String adminUsername) {
        log.debug("dismiss: requestId={}, adminUserId={}", requestId, adminUserId);
        MediaRequestEntity request = requestRepo.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("MediaRequest", "id", requestId));

        if (request.getStatus() == MediaRequestStatus.DISMISSED) {
            log.warn("Media request already dismissed, skipping: id={}", requestId);
            return toDto(request, adminUserId);
        }

        String trimmed = (reason == null || reason.isBlank()) ? null : reason.trim();
        request.setStatus(MediaRequestStatus.DISMISSED);
        request.setDismissReason(trimmed);
        requestRepo.save(request);
        log.info("Media request dismissed: id={}, recordId={}, voters={}, hasReason={}, adminUserId={}",
                requestId, request.getRecordId(),
                request.getVoterUserIds() == null ? 0 : request.getVoterUserIds().size(),
                trimmed != null, adminUserId);

        notifService.createRequestDismissedNotifications(
                adminUserId,
                adminUsername,
                request.getRecordId(),
                request.getRecordTitle(),
                request.getRecordType(),
                trimmed,
                request.getVoterUserIds()
        );

        return toDto(request, adminUserId);
    }

    @Override
    @Transactional
    public MediaRequestDto reopen(Long requestId) {
        log.debug("reopen: requestId={}", requestId);
        MediaRequestEntity request = requestRepo.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("MediaRequest", "id", requestId));
        MediaRequestStatus prev = request.getStatus();
        request.setStatus(MediaRequestStatus.PENDING);
        request.setFulfilledAt(null);
        request.setFulfilledByUserId(null);
        request.setFulfilledByUsername(null);
        request.setDismissReason(null);
        requestRepo.save(request);
        log.info("Media request reopened by admin: id={}, prevStatus={}", requestId, prev);
        return toDto(request, null);
    }

    private MediaRequestDto toDto(MediaRequestEntity e, Long callerUserId) {
        Set<Long> voters = e.getVoterUserIds();
        return MediaRequestDto.builder()
                .id(e.getId())
                .recordId(e.getRecordId())
                .recordTitle(e.getRecordTitle())
                .recordType(e.getRecordType())
                .kind(e.getKind())
                .status(e.getStatus())
                .voteCount(voters == null ? 0 : voters.size())
                .hasMyVote(callerUserId != null && voters != null && voters.contains(callerUserId))
                .createdAt(e.getCreatedAt())
                .fulfilledAt(e.getFulfilledAt())
                .fulfilledByUsername(e.getFulfilledByUsername())
                .dismissReason(e.getDismissReason())
                .build();
    }
}
