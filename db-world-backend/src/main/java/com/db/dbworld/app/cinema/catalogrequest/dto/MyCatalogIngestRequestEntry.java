package com.db.dbworld.app.cinema.catalogrequest.dto;

import com.db.dbworld.app.cinema.enums.RecordType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MyCatalogIngestRequestEntry {
    private Long tmdbId;
    private RecordType mediaType;
}
