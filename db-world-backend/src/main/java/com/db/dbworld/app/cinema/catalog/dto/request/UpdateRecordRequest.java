package com.db.dbworld.app.cinema.catalog.dto.request;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.enums.RecordVisibility;
import com.db.dbworld.app.cinema.validation.ValidRecordType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateRecordRequest {

    @NotNull
    @ValidRecordType
    private RecordType type;

    @NotNull
    private Long tmdbId;

    /** Optional — when present, set the record's visibility (DRAFT / PUBLISHED / UNLISTED). */
    private RecordVisibility visibility;
}