package com.db.dbworld.app.tally.dto;

import jakarta.validation.constraints.Size;

/**
 * A rename, an archive, or an un-archive. Null fields are left alone.
 *
 * @param archived               true to archive, false to reopen, null to leave as is
 * @param settleOutstandingLater acknowledgement that archiving may strand unsettled balances.
 *                               Archiving is refused without it while anybody is up or down;
 *                               see {@code TallyGroupService.update} for why it is a speed bump
 *                               rather than a wall.
 */
public record UpdateGroupRequest(
        @Size(max = 120) String name,
        @Size(max = 60) String category,
        @Size(max = 8) String icon,
        Boolean archived,
        boolean settleOutstandingLater
) {}
