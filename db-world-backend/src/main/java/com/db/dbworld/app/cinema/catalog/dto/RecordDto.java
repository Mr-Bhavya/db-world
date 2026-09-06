package com.db.dbworld.app.cinema.catalog.dto;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.enums.RecordVisibility;
import com.db.dbworld.app.cinema.tmdb.dto.TmdbDto;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.Date;
import java.util.List;

@Getter
@Setter
public class RecordDto {

    private Long id;

    private String name;

    private RecordType type;

    private Long tmdb_id;

    private Instant creationDate;

    private Instant lastModifiedDate;

    private TmdbDto tmdb;

    private List<RecordTagDto> tags;

    private RecordVisibility visibility;

    private Instant newReleaseNotifiedAt;

    /** When the record first went PUBLISHED. Null for records never published. */
    private Instant publishedAt;

    /**
     * What the library holds — public, so a signed-out visitor gets an honest page.
     *
     * <p>Null only on the admin paths that build this DTO without asking. The record
     * page must treat null as "unknown" rather than "unavailable": inferring absence
     * from a missing answer is the bug this field exists to remove.
     */
    private RecordAvailabilityDto availability;

}