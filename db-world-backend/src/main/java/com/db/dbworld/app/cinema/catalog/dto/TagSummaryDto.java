package com.db.dbworld.app.cinema.catalog.dto;

import com.db.dbworld.app.cinema.enums.RecordTagType;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class TagSummaryDto {

    private final RecordTagType tagType;

    /** How many records currently carry this tag. */
    private final long count;

    /**
     * True  = tag is assigned automatically by the strategy scheduler.
     * False = tag is manually assigned by an admin (EDITOR_PICK).
     */
    private final boolean automatic;
}
