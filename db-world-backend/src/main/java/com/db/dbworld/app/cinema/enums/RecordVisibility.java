package com.db.dbworld.app.cinema.enums;

/**
 * A record's public visibility lifecycle. Replaces the old {@code hideFromRails} boolean, combining
 * "is this public at all?" and "should it appear on rails?" into one field with no invalid combos.
 *
 * <ul>
 *   <li>{@link #DRAFT} — not public. Excluded from rails, search, and the public detail endpoint;
 *       visible only in the admin console. New records start here, so nothing is announced or shown
 *       until an admin publishes it. No "new title" push.</li>
 *   <li>{@link #PUBLISHED} — fully public: rails + search + detail. (The old {@code hideFromRails=false}.)
 *       The one-time "New on DB World" push fires when a record first reaches this state.</li>
 *   <li>{@link #UNLISTED} — public but off the rails: still searchable and reachable by direct link,
 *       just not surfaced on home/category rails. (The old {@code hideFromRails=true} — e.g. 18+ or
 *       library-only deep cuts.) No broadcast push, by design.</li>
 * </ul>
 */
public enum RecordVisibility {
    DRAFT,
    PUBLISHED,
    UNLISTED;

    /** Public = reachable by users at all (search + direct link); only {@link #DRAFT} is not. */
    public boolean isPublic() {
        return this != DRAFT;
    }

    /** Whether the record should surface on rails (home / category / "more like this"). */
    public boolean isOnRails() {
        return this == PUBLISHED;
    }
}
