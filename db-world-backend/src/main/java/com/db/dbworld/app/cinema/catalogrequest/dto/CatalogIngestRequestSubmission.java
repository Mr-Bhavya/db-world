package com.db.dbworld.app.cinema.catalogrequest.dto;

import com.db.dbworld.app.cinema.enums.RecordType;
import lombok.Data;

@Data
public class CatalogIngestRequestSubmission {
    private Long tmdbId;
    private RecordType mediaType;
    private String title;
    private String posterPath;
    private String releaseYear;
    private String note;
}
