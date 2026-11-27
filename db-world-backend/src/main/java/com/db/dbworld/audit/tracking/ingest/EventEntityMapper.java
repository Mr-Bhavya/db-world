package com.db.dbworld.audit.tracking.ingest;

import com.db.dbworld.audit.tracking.aggregate.TrackEvent;
import com.db.dbworld.audit.tracking.entity.ActivityEventEntity;

import java.time.Instant;

/** Maps a TrackEvent to its append-only ActivityEventEntity row. */
final class EventEntityMapper {
    private EventEntityMapper() {}

    static ActivityEventEntity toEntity(TrackEvent e) {
        return ActivityEventEntity.builder()
                .eventTime(e.eventTime() != null ? e.eventTime() : Instant.now())
                .receivedAt(Instant.now())
                .userId(e.userId())
                .sessionId(e.sessionId())
                .clientEventId(e.clientEventId())
                .activity(e.activity())
                .eventType(e.type())
                .channel(e.channel())
                .clientApp(e.clientApp() != null ? e.clientApp().name() : null)
                .source(e.source())
                .mediaFileId(e.mediaFileId())
                .recordId(e.recordId())
                .seasonNumber(e.seasonNumber())
                .episodeNumber(e.episodeNumber())
                .filePath(e.filePath())
                .fileSize(e.fileSize())
                .cumulativeBytes(e.cumulativeBytes())
                .speedBps(e.speedBps())
                .connections(e.connections())
                .positionMs(e.positionMs())
                .durationMs(e.durationMs())
                .completionPercent(e.completionPercent())
                .errorCode(truncate(e.errorCode(), 40))
                .errorMessage(truncate(e.errorMessage(), 512))
                .searchQuery(truncate(e.searchQuery(), 256))
                .resultCount(e.resultCount())
                .remoteAddr(e.remoteAddr())
                .userAgent(e.userAgent())
                .build();
    }

    private static String truncate(String value, int maxLength) {
        return value == null || value.length() <= maxLength
                ? value
                : value.substring(0, maxLength);
    }
}
