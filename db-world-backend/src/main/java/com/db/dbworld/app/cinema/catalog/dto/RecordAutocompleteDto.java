package com.db.dbworld.app.cinema.catalog.dto;

import com.db.dbworld.cinema.enums.RecordType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecordAutocompleteDto {

    private Long id;

    private String name;

    private RecordType type;

    private Long tmdbId;

    private String posterPath;
}