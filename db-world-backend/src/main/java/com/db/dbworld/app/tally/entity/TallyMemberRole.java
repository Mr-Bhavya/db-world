package com.db.dbworld.app.tally.entity;

/**
 * What a member is allowed to do to the group itself, as opposed to their own rows.
 *
 * <p>Anyone can add an expense and settle their own debts. {@link #OWNER} additionally gates the
 * three actions that affect other people: voiding someone else's expense, removing a member, and
 * archiving the group.
 */
public enum TallyMemberRole {
    OWNER,
    MEMBER
}
