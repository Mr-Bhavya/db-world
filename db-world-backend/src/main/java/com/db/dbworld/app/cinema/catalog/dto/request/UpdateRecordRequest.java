package com.db.dbworld.app.cinema.catalog.dto.request;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.enums.RecordVisibility;
import com.db.dbworld.app.cinema.validation.ValidRecordType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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

    /**
     * Original DB World commentary. At least 300 non-whitespace characters makes a
     * published record eligible for search indexing; shorter text remains useful to
     * visitors without changing the page's noindex status.
     */
    @Size(max = 5000)
    private String editorialNote;
}