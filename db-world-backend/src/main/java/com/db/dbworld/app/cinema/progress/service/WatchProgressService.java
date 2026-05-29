package com.db.dbworld.app.cinema.progress.service;

import com.db.dbworld.app.cinema.progress.entity.WatchProgressEntity;
import com.db.dbworld.app.cinema.progress.repository.WatchProgressRepository;
import com.db.dbworld.audit.activity.entity.UserCinemaActivityEntity.ActivityType;
import com.db.dbworld.audit.activity.repository.UserCinemaActivityRepository;
import lombok.Builder;
import lombok.RequiredArgsConstructor;
import lombok.Value;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Log4j2
@Service
@RequiredArgsConstructor
@Transactional
public class WatchProgressService {

    /** Threshold (fraction) above which a save is treated as a "completed" milestone. */
    private static final double COMPLETION_THRESHOLD = 0.95;

    private final WatchProgressRepository       repository;
    private final UserCinemaActivityRepository  userCinemaActivityRepository;

    @Value
    @Builder
    public static class ProgressDto {
        String fileId;
        Long recordId;
        Long positionMs;
        Long durationMs;
        String audioLang;
        String subLang;
        Instant updatedAt;
    }

    public void saveProgress(Long userId, String fileId, Long recordId,
                              Long positionMs, Long durationMs,
                              String audioLang, String subLang) {
        // Atomic upsert: the player can fire two saves for the same (user, file) within
        // milliseconds. The prior find-then-insert flow raced and surfaced the
        // uk_user_file_progress duplicate-key error. ON DUPLICATE KEY UPDATE resolves it
        // server-side without us needing locking or retries.
        repository.upsert(
                userId, fileId, recordId,
                positionMs, durationMs,
                audioLang, subLang,
                Instant.now()
        );

        // Phase 3 — backfill user_cinema_activity.watch_progress_id for STREAM rows
        // whose /resolve happened before the user first ticked progress. Idempotent:
        // the setter no-ops when the FK is already populated.
        // We also reuse this read for milestone logging (avoid a second DB hit on the
        // hot per-second-save path).
        Optional<WatchProgressEntity> saved = repository.findByUserIdAndFileId(userId, fileId);
        saved.ifPresent(wp ->
                userCinemaActivityRepository
                        .findByUserIdAndMediaFileIdAndActivityType(userId, fileId, ActivityType.STREAM)
                        .filter(uca -> uca.getWatchProgressId() == null)
                        .ifPresent(uca -> userCinemaActivityRepository
                                .setWatchProgressIdById(uca.getId(), wp.getId())));

        // Milestone logging — keep per-second ticks at DEBUG; promote to INFO only when
        // the user has reached the ≥95% completion threshold (will fire repeatedly on
        // subsequent saves near the end of a file — acceptable for "completed" status).
        boolean completed = durationMs != null && durationMs > 0 && positionMs != null
                && ((double) positionMs / (double) durationMs) >= COMPLETION_THRESHOLD;
        if (completed) {
            log.info("Watch progress at completion (≥95%): userId={}, fileId={}, recordId={}, positionMs={}, durationMs={}",
                    userId, fileId, recordId, positionMs, durationMs);
        } else {
            log.debug("Watch progress saved: userId={}, fileId={}, positionMs={}, durationMs={}",
                    userId, fileId, positionMs, durationMs);
        }
    }

    public Optional<ProgressDto> getProgress(Long userId, String fileId) {
        return repository.findByUserIdAndFileId(userId, fileId).map(this::toDto);
    }

    public List<ProgressDto> getRecentProgress(Long userId, int days) {
        Instant cutoff = Instant.now().minus(days, ChronoUnit.DAYS);
        return repository
                .findByUserIdAndUpdatedAtAfterOrderByUpdatedAtDesc(userId, cutoff)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    private ProgressDto toDto(WatchProgressEntity e) {
        return ProgressDto.builder()
                .fileId(e.getFileId()).recordId(e.getRecordId())
                .positionMs(e.getPositionMs()).durationMs(e.getDurationMs())
                .audioLang(e.getAudioLang()).subLang(e.getSubLang())
                .updatedAt(e.getUpdatedAt()).build();
    }
}
