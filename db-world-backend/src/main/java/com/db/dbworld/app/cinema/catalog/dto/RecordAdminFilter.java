package com.db.dbworld.app.cinema.catalog.dto;

import com.db.dbworld.app.cinema.enums.RecordType;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RecordAdminFilter {

    private String name;

    private Long tmdbId;

    private Long recordId;

    private Integer year;

    private RecordType type;

}
