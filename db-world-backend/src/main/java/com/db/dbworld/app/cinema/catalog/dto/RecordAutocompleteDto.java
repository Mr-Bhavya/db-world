package com.db.dbworld.app.cinema.catalog.dto;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.enums.RecordVisibility;
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

    /** Publish state — lets the admin picker flag DRAFT records (only populated by the admin autocomplete). */
    private RecordVisibility visibility;
}