package com.db.dbworld.app.cinema.catalog.dto.request;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.validation.ValidRecordType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateRecordRequest {

    @NotNull
    @ValidRecordType
    private RecordType type;

    @NotNull
    private Long tmdbId;

    // Note: new records are always created as DRAFT (not public). An admin makes them public later
    // via the publish/visibility action — see CatalogService.setVisibility.
}