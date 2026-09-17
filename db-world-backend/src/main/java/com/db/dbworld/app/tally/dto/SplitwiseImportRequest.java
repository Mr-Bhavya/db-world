package com.db.dbworld.app.tally.dto;

import com.db.dbworld.app.tally.service.importer.SplitwiseCsv;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Commit an export into a brand new group.
 *
 * <p>Always a new group, never an existing one. Merging two years of somebody else's history
 * into a live ledger would interleave it with expenses that are already settled, and there is
 * no way to undo it afterwards — the ledger is append-only by design. A fresh group can simply
 * be archived if the import turns out wrong.
 *
 * <p>The CSV is sent again rather than held server-side between the preview and this. It is a
 * few kilobytes, and the alternative is a store of half-finished imports that can go stale,
 * leak, or be committed by somebody else.
 *
 * @param people one entry per column in the file, in any order, naming who each column is.
 */
public record SplitwiseImportRequest(
        @NotBlank @Size(max = SplitwiseCsv.MAX_CHARS) String csv,
        @NotBlank @Size(max = 120) String groupName,
        @Size(max = 60) String groupCategory,
        @Size(max = 8) String icon,
        @NotEmpty @Valid List<PersonMapping> people
) {
    /**
     * @param csvName  the column heading, exactly as it appears in the file.
     * @param userId   the db-world account this person is, or null for somebody with no account.
     * @param displayName what to call them here. Defaults to the CSV name when blank.
     */
    public record PersonMapping(
            @NotBlank String csvName,
            Long userId,
            @Size(max = 120) String displayName
    ) {}
}
