package com.db.dbworld.app.tally.dto;

import jakarta.validation.constraints.Size;

/**
 * Start a running total with one other person.
 *
 * <p>No name and no category, because there is nothing to name — the ledger is simply "you and
 * them". Making somebody invent a group name to record one shared taxi is exactly the friction
 * this exists to remove.
 *
 * <p>Supply {@code userId} for a db-world account, or {@code displayName} for somebody without
 * one. Same two kinds of person as everywhere else in the module.
 */
public record CreateDirectRequest(
        Long userId,
        @Size(max = 120) String displayName
) {}
