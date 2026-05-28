package com.db.dbworld.app.cinema.catalog.dto;

import com.db.dbworld.app.cinema.enums.RecordType;
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

    private boolean hideFromRails;

}