package com.db.dbworld.audit.activity.dto;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.audit.activity.entity.UserCinemaActivityEntity.ActivityType;
import com.db.dbworld.audit.activity.entity.UserCinemaActivityEntity.ClientType;
import com.db.dbworld.audit.activity.entity.UserCinemaActivityEntity.CompletionStatus;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Unified read view of a user_cinema_activity row joined with watch_progress (live cursor
 * for STREAM rows) and records (catalog title/type). Returned by
 * {@code GET /api/me/activity} and consumed by the {@code /me/activity} frontend page.
 *
 * <p>{@code positionMs}, {@code durationMs}, {@code audioLang}, {@code subLang} are
 * null for DOWNLOAD rows (no live cursor) and for streams the user hasn't ticked yet.
 * {@code recordId}, {@code recordTitle}, {@code recordType} are null for legacy rows
 * whose enrichment found no matching media_files entry.
 */
public record UserActivityViewDto(
        Long id,
        ActivityType activityType,
        Long recordId,
        String recordTitle,
        RecordType recordType,
        String filePath,
        Long fileSize,
        String mediaFileId,
        CompletionStatus completionStatus,
        BigDecimal completionPercent,
        Integer downloadCount,
        Integer streamCount,
        ClientType clientType,
        Long avgSpeedBps,
        Instant lastUpdated,
        Instant lastCompletedAt,
        Long positionMs,
        Long durationMs,
        String audioLang,
        String subLang
) {

    /** Map a Spring Data projection (raw VARCHAR enum columns) to the typed DTO. */
    public static UserActivityViewDto from(UserActivityProjection p) {
        return new UserActivityViewDto(
                p.getId(),
                p.getActivityType() != null ? ActivityType.valueOf(p.getActivityType()) : null,
                p.getRecordId(),
                p.getRecordTitle(),
                p.getRecordType() != null ? RecordType.valueOf(p.getRecordType()) : null,
                p.getFilePath(),
                p.getFileSize(),
                p.getMediaFileId(),
                p.getCompletionStatus() != null ? CompletionStatus.valueOf(p.getCompletionStatus()) : null,
                p.getCompletionPercent(),
                p.getDownloadCount(),
                p.getStreamCount(),
                p.getClientType() != null ? ClientType.valueOf(p.getClientType()) : null,
                p.getAvgSpeedBps(),
                p.getLastUpdated(),
                p.getLastCompletedAt(),
                p.getPositionMs(),
                p.getDurationMs(),
                p.getAudioLang(),
                p.getSubLang()
        );
    }
}
