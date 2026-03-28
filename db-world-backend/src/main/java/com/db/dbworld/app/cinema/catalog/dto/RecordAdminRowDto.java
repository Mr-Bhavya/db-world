package com.db.dbworld.app.cinema.catalog.dto;

import com.db.dbworld.cinema.enums.RecordType;

import java.time.Instant;

public interface RecordAdminRowDto {

    Long getRecordId();

    String getName();

    RecordType getType();

    Long getTmdbId();

    Integer getYear();

    Instant getCreatedAt();

    Instant getUpdatedAt();

    String getTags();
}