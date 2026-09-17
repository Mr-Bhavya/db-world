package com.db.dbworld.app.tally.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

/**
 * Somebody to add - either a db-world account or a ghost.
 *
 * <p>Supplying {@code userId} adds a real member; omitting it adds a ghost, who needs only a
 * name. Ghosts are the reason this module exists in the shape it does: a family member who
 * will never create an account still has to be able to owe and be owed.
 */
public record AddMemberRequest(
        Long userId,
        @Size(max = 120) String displayName,
        @Email @Size(max = 190) String email
) {}
