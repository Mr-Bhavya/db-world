package com.db.dbworld.audit.tracking.admin.dto;

import java.time.LocalDate;

/**
 * Native daily-trend aggregate over {@code activity_session}. MySQL Connector/J
 * returns SQL DATE columns as {@link LocalDate} — match the native type here
 * (see {@code AdminAnalyticsService}'s DailyActivityProjection for precedent).
 */
public interface TrendProjection {
    LocalDate getDate();
    Long getStreams();
    Long getDownloads();
    Long getUniqueBytes();
}
