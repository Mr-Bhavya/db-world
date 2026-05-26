package com.db.dbworld.audit.activity.dto;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Spring Data projection interface returned by
 * {@link com.db.dbworld.audit.activity.repository.UserCinemaActivityRepository#findUserActivityView}.
 * Mapped via column aliases in the native SQL. Convert to {@link UserActivityViewDto}
 * via {@link UserActivityViewDto#from(UserActivityProjection)} at the service layer.
 *
 * <p>Enum-shaped columns ({@code activity_type}, {@code completion_status},
 * {@code client_type}) come back as raw VARCHAR — the DTO does the enum mapping.
 */
public interface UserActivityProjection {

    Long getId();

    String getActivityType();

    Long getRecordId();

    String getRecordTitle();

    String getRecordType();

    String getFilePath();

    Long getFileSize();

    String getMediaFileId();

    String getCompletionStatus();

    BigDecimal getCompletionPercent();

    Integer getDownloadCount();

    Integer getStreamCount();

    String getClientType();

    Long getAvgSpeedBps();

    Instant getLastUpdated();

    Instant getLastCompletedAt();

    Long getPositionMs();

    Long getDurationMs();

    String getAudioLang();

    String getSubLang();
}
