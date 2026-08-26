package com.db.dbworld.app.cinema.catalog.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class TagSummaryDto {

    private final String tagType;

    /** How many records currently carry this tag. */
    private final long count;

    /** Admin-facing label, from {@code tag_definitions.display_name}. */
    private final String displayName;

    /**
     * True  = a TagStrategy computes this tag, so the scheduler will overwrite manual edits.
     * False = admin-curated; nothing else ever touches it.
     */
    private final boolean automatic;

    /** False when an admin has switched the tag off, so the scheduler skips it. */
    private final boolean active;

    /** True for tags declared in {@code RecordTagType} — these cannot be renamed or deleted. */
    private final boolean builtIn;

    /**
     * True when this tag is automatic because of an admin-authored rule rather than built-in code.
     * Those rules are editable in the UI; a built-in strategy is not.
     */
    private final boolean ruleDriven;
}
