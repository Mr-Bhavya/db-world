package com.db.dbworld.app.cinema.catalog.dto.request;

import com.db.dbworld.cinema.enums.RecordType;
import com.db.dbworld.cinema.validation.ValidRecordType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateRecordRequest {

    @NotNull
    @ValidRecordType
    private RecordType type;

    @NotNull
    private Long tmdbId;
}