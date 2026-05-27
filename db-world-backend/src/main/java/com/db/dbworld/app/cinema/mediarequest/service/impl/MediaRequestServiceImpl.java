package com.db.dbworld.app.cinema.mediarequest.service.impl;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.mediarequest.dto.MediaRequestDto;
import com.db.dbworld.app.cinema.mediarequest.dto.MediaRequestVoteResponse;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestEntity;
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
    public MediaRequestVoteResponse toggleVote(Long recordId, Long userId) {
        MediaRequestEntity request = requestRepo.findByRecordId(recordId).orElse(null);

        if (request == null) {
            RecordEntity record = recordRepo.findById(recordId)
                    .orElseThrow(() -> new ResourceNotFoundException("Record", "id", recordId));

            Set<Long> voters = new HashSet<>();
            voters.add(userId);

            request = MediaRequestEntity.builder()
                    .recordId(recordId)
                    .recordTitle(record.getName())
                    .recordType(record.getType().name())
                    .status(MediaRequestStatus.PENDING)
                    .voterUserIds(voters)
                    .build();
            request = requestRepo.save(request);

            return MediaRequestVoteResponse.builder()
                    .recordId(recordId)
                    .voteCount(1)
                    .hasMyVote(true)
                    .build();
        }

        // If previously fulfilled or dismissed, treat a new vote as re-opening the request.
        if (request.getStatus() != MediaRequestStatus.PENDING) {
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
        }

        return MediaRequestVoteResponse.builder()
                .recordId(recordId)
                .voteCount(voteCount)
                .hasMyVote(hasMyVote)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Long> getMyPendingRecordIds(Long userId) {
        return requestRepo.findPendingRecordIdsVotedBy(userId);
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
        MediaRequestEntity request = requestRepo.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("MediaRequest", "id", requestId));

        if (request.getStatus() == MediaRequestStatus.FULFILLED) {
            return toDto(request, adminUserId);
        }

        request.setStatus(MediaRequestStatus.FULFILLED);
        request.setFulfilledAt(Instant.now());
        request.setFulfilledByUserId(adminUserId);
        request.setFulfilledByUsername(adminUsername);
        requestRepo.save(request);

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
    public MediaRequestDto dismiss(Long requestId) {
        MediaRequestEntity request = requestRepo.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("MediaRequest", "id", requestId));
        request.setStatus(MediaRequestStatus.DISMISSED);
        requestRepo.save(request);
        return toDto(request, null);
    }

    @Override
    @Transactional
    public MediaRequestDto reopen(Long requestId) {
        MediaRequestEntity request = requestRepo.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("MediaRequest", "id", requestId));
        request.setStatus(MediaRequestStatus.PENDING);
        request.setFulfilledAt(null);
        request.setFulfilledByUserId(null);
        request.setFulfilledByUsername(null);
        requestRepo.save(request);
        return toDto(request, null);
    }

    private MediaRequestDto toDto(MediaRequestEntity e, Long callerUserId) {
        Set<Long> voters = e.getVoterUserIds();
        return MediaRequestDto.builder()
                .id(e.getId())
                .recordId(e.getRecordId())
                .recordTitle(e.getRecordTitle())
                .recordType(e.getRecordType())
                .status(e.getStatus())
                .voteCount(voters == null ? 0 : voters.size())
                .hasMyVote(callerUserId != null && voters != null && voters.contains(callerUserId))
                .createdAt(e.getCreatedAt())
                .fulfilledAt(e.getFulfilledAt())
                .fulfilledByUsername(e.getFulfilledByUsername())
                .build();
    }
}
