package com.db.dbworld.app.tally.entity;

/**
 * Whether a member is still part of the group's roster.
 *
 * <p>A status rather than a soft-delete flag, and a status rather than a row deletion, because
 * {@code uk_tally_group_member_group_user} survives removal: re-adding somebody has to be an
 * UPDATE back to {@link #ACTIVE}, never a second INSERT. A second row would carry a new id and
 * fork the person's identity away from every historical share and ledger row already pointing at
 * the first one, which is how a balance quietly stops adding up.
 */
public enum TallyMemberStatus {
    ACTIVE,
    LEFT
}
