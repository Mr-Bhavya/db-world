package com.db.dbworld.app.cinema.mediarequest.service.impl;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.common.dto.VoterSummary;
import com.db.dbworld.app.cinema.common.support.RequestPushLinks;
import com.db.dbworld.app.cinema.common.support.VoterListSupport;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.mediarequest.dto.MediaRequestDto;
import com.db.dbworld.app.cinema.mediarequest.dto.MediaRequestScopeSummary;
import com.db.dbworld.app.cinema.mediarequest.dto.MediaRequestVoteResponse;
import com.db.dbworld.app.cinema.mediarequest.dto.MyMediaRequestEntry;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestEntity;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestKind;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestScope;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestStatus;
import com.db.dbworld.app.cinema.mediarequest.repository.MediaRequestRepository;
import com.db.dbworld.app.cinema.mediarequest.service.MediaRequestService;
import com.db.dbworld.app.cinema.notification.service.UserNotificationService;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.exception.ResourceNotFoundException;
import com.db.dbworld.core.push.PushService;
import com.db.dbworld.core.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MediaRequestServiceImpl implements MediaRequestService {

    private final MediaRequestRepository requestRepo;
    private final RecordRepository recordRepo;
    private final UserRepository userRepo;
    private final UserNotificationService notifService;
    private final PushService pushService;

    @Override
    @Transactional
    public MediaRequestVoteResponse toggleVote(Long recordId, Long userId, MediaRequestKind kindIn,
                                               Integer season, Integer episode) {
        MediaRequestKind kind = kindIn == null ? MediaRequestKind.NEW_FILES : kindIn;
        MediaRequestScope scope = MediaRequestScope.of(season, episode);
        log.debug("toggleVote: recordId={}, userId={}, kind={}, scope={}", recordId, userId, kind, scope.label());

        MediaRequestEntity request = requestRepo
                .findByRecordIdAndKindAndSeasonNumberAndEpisodeNumber(recordId, kind, scope.season(), scope.episode())
                .orElse(null);

        if (request == null) {
            RecordEntity record = recordRepo.findById(recordId)
                    .orElseThrow(() -> new ResourceNotFoundException("Record", "id", recordId));

            // A season/episode ask only means something for a series. Checked on creation only:
            // an existing row was already validated when it was created.
            if (!scope.isWholeTitle() && record.getType() != RecordType.TV_SERIES) {
                throw new DbWorldException(HttpStatus.BAD_REQUEST,
                        "Season and episode requests apply to series only");
            }

            Set<Long> voters = new HashSet<>();
            voters.add(userId);

            request = MediaRequestEntity.builder()
                    .recordId(recordId)
                    .recordTitle(record.getName())
                    .recordType(record.getType().name())
                    .kind(kind)
                    .seasonNumber(scope.season())
                    .episodeNumber(scope.episode())
                    .status(MediaRequestStatus.PENDING)
                    .voterUserIds(voters)
                    .build();
            request = requestRepo.save(request);
            log.info("Media request created: id={}, recordId={}, kind={}, scope={}, firstVoter={}",
                    request.getId(), recordId, kind, scope.label(), userId);

            // A brand-new request row -> alert admins only. Best-effort; never break the vote.
            try {
                pushService.broadcastToAdmins("New request",
                        scope.qualify(record.getName()) + " - " + kindLabel(kind),
                        Map.of("route", "admin/requests"), "admin");
            } catch (Exception e) {
                log.debug("New media-request admin push failed for recordId={}: {}", recordId, e.toString());
            }

            return MediaRequestVoteResponse.of(recordId, kind, scope, 1, true);
        }

        // Fulfilled/dismissed -> a fresh vote re-opens it. Old voters are reset so the
        // new PENDING run starts clean; admins get a new aggregated count.
        if (request.getStatus() != MediaRequestStatus.PENDING) {
            log.info("Media request reopened by fresh vote: id={}, recordId={}, kind={}, scope={}, prevStatus={}, userId={}",
                    request.getId(), recordId, kind, scope.label(), request.getStatus(), userId);
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
            log.info("Media request pruned (no voters): id={}, recordId={}, kind={}, scope={}",
                    request.getId(), recordId, kind, scope.label());
        } else {
            log.info("Media request vote {}: requestId={}, recordId={}, kind={}, scope={}, userId={}, voteCount={}",
                    removed ? "removed" : "cast", request.getId(), recordId, kind, scope.label(), userId, voteCount);
        }

        return MediaRequestVoteResponse.of(recordId, kind, scope, voteCount, hasMyVote);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MyMediaRequestEntry> getMyPendingRequests(Long userId) {
        return requestRepo.findPendingVotedBy(userId).stream()
                .map(MyMediaRequestEntry::from)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<MediaRequestScopeSummary> listPendingForRecord(Long recordId, Long callerUserId) {
        return requestRepo.findPendingForRecordWithVoters(recordId).stream()
                .map(r -> MediaRequestScopeSummary.from(r, callerUserId))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<MediaRequestDto> listAll(MediaRequestStatus status, Long callerUserId) {
        List<MediaRequestEntity> rows = (status == null)
                ? requestRepo.findAllWithVoters()
                : requestRepo.findAllByStatusWithVoters(status);

        Set<Long> allVoterIds = rows.stream()
                .map(MediaRequestEntity::getVoterUserIds)
                .filter(s -> s != null && !s.isEmpty())
                .flatMap(Set::stream)
                .collect(Collectors.toSet());
        Map<Long, VoterSummary> voterCache = loadVoterCache(allVoterIds);

        return rows.stream().map(r -> toDto(r, callerUserId, voterCache)).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public long countByStatus(MediaRequestStatus status) {
        return requestRepo.countByStatus(status);
    }

    @Override
    @Transactional
    public MediaRequestDto fulfill(Long requestId, Long adminUserId, String adminUsername) {
        log.debug("fulfill: requestId={}, adminUserId={}", requestId, adminUserId);
        MediaRequestEntity request = requestRepo.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("MediaRequest", "id", requestId));

        if (request.getStatus() == MediaRequestStatus.FULFILLED) {
            log.warn("Media request already fulfilled, skipping: id={}", requestId);
            return toDto(request, adminUserId, loadVoterCache(request.getVoterUserIds()));
        }

        request.setStatus(MediaRequestStatus.FULFILLED);
        request.setFulfilledAt(Instant.now());
        request.setFulfilledByUserId(adminUserId);
        request.setFulfilledByUsername(adminUsername);
        requestRepo.save(request);
        log.info("Media request fulfilled: id={}, recordId={}, scope={}, voters={}, adminUserId={}",
                requestId, request.getRecordId(), request.scope().label(),
                request.getVoterUserIds() == null ? 0 : request.getVoterUserIds().size(),
                adminUserId);

        // Voters are told WHAT landed, not just which show: "Breaking Bad - S02E05".
        String scopedTitle = request.scope().qualify(request.getRecordTitle());

        notifService.createRequestFulfilledNotifications(
                adminUserId,
                adminUsername,
                request.getRecordId(),
                scopedTitle,
                request.getRecordType(),
                request.getVoterUserIds()
        );

        // Targeted "request fulfilled" push to the voters (same recipients as the in-app notification).
        pushRequestUpdate("Request fulfilled", request.getRecordId(), scopedTitle,
                request.getRecordTitle(), request.getRecordType(), request.getVoterUserIds());

        return toDto(request, adminUserId, loadVoterCache(request.getVoterUserIds()));
    }

    @Override
    @Transactional
    public MediaRequestDto dismiss(Long requestId, String reason, Long adminUserId, String adminUsername) {
        log.debug("dismiss: requestId={}, adminUserId={}", requestId, adminUserId);
        MediaRequestEntity request = requestRepo.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("MediaRequest", "id", requestId));

        if (request.getStatus() == MediaRequestStatus.DISMISSED) {
            log.warn("Media request already dismissed, skipping: id={}", requestId);
            return toDto(request, adminUserId, loadVoterCache(request.getVoterUserIds()));
        }

        String trimmed = (reason == null || reason.isBlank()) ? null : reason.trim();
        request.setStatus(MediaRequestStatus.DISMISSED);
        request.setDismissReason(trimmed);
        requestRepo.save(request);
        log.info("Media request dismissed: id={}, recordId={}, scope={}, voters={}, hasReason={}, adminUserId={}",
                requestId, request.getRecordId(), request.scope().label(),
                request.getVoterUserIds() == null ? 0 : request.getVoterUserIds().size(),
                trimmed != null, adminUserId);

        String scopedTitle = request.scope().qualify(request.getRecordTitle());

        notifService.createRequestDismissedNotifications(
                adminUserId,
                adminUsername,
                request.getRecordId(),
                scopedTitle,
                request.getRecordType(),
                trimmed,
                request.getVoterUserIds()
        );

        // Targeted "request dismissed" push to the voters (same recipients as the in-app notification).
        pushRequestUpdate("Request dismissed", request.getRecordId(), scopedTitle,
                request.getRecordTitle(), request.getRecordType(), request.getVoterUserIds());

        return toDto(request, adminUserId, loadVoterCache(request.getVoterUserIds()));
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
        return toDto(request, null, loadVoterCache(request.getVoterUserIds()));
    }

    private MediaRequestDto toDto(MediaRequestEntity e, Long callerUserId, Map<Long, VoterSummary> voterCache) {
        Set<Long> voters = e.getVoterUserIds();
        MediaRequestScope scope = e.scope();
        return MediaRequestDto.builder()
                .id(e.getId())
                .recordId(e.getRecordId())
                .recordTitle(e.getRecordTitle())
                .recordType(e.getRecordType())
                .kind(e.getKind())
                .season(scope.seasonOrNull())
                .episode(scope.episodeOrNull())
                .scopeLabel(scope.label())
                .status(e.getStatus())
                .voteCount(voters == null ? 0 : voters.size())
                .hasMyVote(callerUserId != null && voters != null && voters.contains(callerUserId))
                .voters(VoterListSupport.buildVoterList(voters, voterCache))
                .createdAt(e.getCreatedAt())
                .fulfilledAt(e.getFulfilledAt())
                .fulfilledByUsername(e.getFulfilledByUsername())
                .dismissReason(e.getDismissReason())
                .build();
    }

    private Map<Long, VoterSummary> loadVoterCache(Collection<Long> userIds) {
        return VoterListSupport.loadVoterCache(userIds, userRepo);
    }

    private static String kindLabel(MediaRequestKind kind) {
        return switch (kind) {
            case NEW_FILES -> "new files";
            case HIGHER_QUALITY -> "higher quality";
            case LOWER_QUALITY -> "lower quality";
        };
    }

    /**
     * Best-effort targeted push to a request's voters on the {@code request-updates} channel. Fully
     * defensive: an empty voter set is a no-op and any failure is swallowed so the underlying
     * fulfil/dismiss operation can never break on a push hiccup.
     *
     * @param bodyTitle   scope-qualified title for the notification body
     * @param recordTitle the bare record title. The deep-link slug is built from this, so the
     *                    scope label must not leak into the URL.
     */
    private void pushRequestUpdate(String title, Long recordId, String bodyTitle,
                                   String recordTitle, String recordType, Collection<Long> voterIds) {
        if (voterIds == null || voterIds.isEmpty()) {
            return;
        }
        try {
            pushService.sendToUsers(voterIds, title,
                    bodyTitle == null || bodyTitle.isBlank() ? title : bodyTitle,
                    RequestPushLinks.recordDeepLink(recordId, recordTitle, recordType),
                    "request-updates");
        } catch (Exception e) {
            log.debug("Request-update push '{}' failed for recordId={}: {}", title, recordId, e.toString());
        }
    }
}
