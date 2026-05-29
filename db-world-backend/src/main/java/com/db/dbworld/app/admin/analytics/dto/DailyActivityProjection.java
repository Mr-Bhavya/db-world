package com.db.dbworld.app.admin.analytics.dto;

import java.time.LocalDate;

/**
 * Hibernate 7 / MySQL Connector/J 9 returns SQL DATE columns as
 * {@link LocalDate}, not {@link java.sql.Date}. Declaring java.sql.Date on
 * a Spring Data projection here previously caused:
 *   UnsupportedOperationException: Cannot project java.time.LocalDate to
 *   java.sql.Date; Target type is not an interface and no matching Converter found
 * Match the native type and drop the conversion.
 */
public interface DailyActivityProjection {
    LocalDate getDate();
    Long getStreams();
    Long getDownloads();
    Long getBytesTransferred();
}
