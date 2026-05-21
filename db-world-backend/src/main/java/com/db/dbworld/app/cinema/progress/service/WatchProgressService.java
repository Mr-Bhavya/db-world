package com.db.dbworld.app.cinema.progress.service;

import com.db.dbworld.app.cinema.progress.entity.WatchProgressEntity;
import com.db.dbworld.app.cinema.progress.repository.WatchProgressRepository;
import lombok.Builder;
import lombok.RequiredArgsConstructor;
import lombok.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class WatchProgressService {

    private final WatchProgressRepository repository;

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
