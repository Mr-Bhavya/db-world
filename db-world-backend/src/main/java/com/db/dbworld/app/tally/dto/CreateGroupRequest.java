package com.db.dbworld.app.tally.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * A new group.
 *
 * <p>No currency field: only INR is offered, and the column exists on the group so that adding
 * a second currency later is additive rather than a migration. Accepting one now would mean
 * validating a choice the rest of the module cannot yet honour.
 */
public record CreateGroupRequest(
        @NotBlank @Size(max = 120) String name,
        @Size(max = 60) String category,
        /** Optional. Left out, the server picks one from the name. */
        @Size(max = 8) String icon
) {}
