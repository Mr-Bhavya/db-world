package com.db.dbworld.app.tally.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * A shared ledger — a household, a trip, a set of friends who eat out together.
 *
 * <p><b>There is no delete path, by design.</b> This module stores plain id columns rather than
 * {@code @ManyToOne} associations, so Hibernate emits no foreign keys and the database will
 * happily let a group row disappear while its members, expenses, shares, ledger entries and
 * settlements stay behind, pointing at nothing. Archiving is therefore the only removal:
 * {@link #archivedAt} hides the group from the roster while leaving every row it owns intact and
 * still reachable by id. Do not add {@code DELETE /groups/{id}} later.
 *
 * <p>{@link #currency} lives here and nowhere else. Putting one on the expense as well would mean
 * two columns with no invariant tying them together, and a {@code SUM} over the expenses would
 * silently add rupees to dollars. It is immutable once the group holds any expense — changing it
 * would reinterpret every amount already recorded. Only INR is offered today; the column exists
 * so that adding a second currency is additive rather than a migration.
 */
@Entity
@Table(name = "tally_group", schema = "db_world",
        indexes = {
            // "my groups" resolves through tally_group_member, so the only lookup that starts
            // here is the creator's own list.
            @Index(name = "idx_tally_group_created_by", columnList = "created_by_user_id")
        })
@Getter @Setter @NoArgsConstructor
public class TallyGroupEntity {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(nullable = false, length = 120) private String name;

    /**
     * Group, or a running total with one other person. See {@link TallyGroupKind}.
     *
     * <p>The explicit {@code columnDefinition} is load-bearing. This column was added after the
     * table already existed, and it carries the DEFAULT into the {@code ALTER TABLE} that
     * {@code ddl-auto: update} generates — so rows written before it existed come back as
     * GROUP rather than NULL. Without it every pre-existing group would fail to read.
     *
     * <p>Adding a column this way is safe; adding or changing an <em>index</em> is not, which
     * is why the keys on this table had to be right on the first deploy and this did not.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20,
            columnDefinition = "varchar(20) not null default 'GROUP'")
    private TallyGroupKind kind = TallyGroupKind.GROUP;

    /** Free text for the UI to badge with ("Home", "Trip", "Flatmates"); not an enum, not validated. */
    @Column(length = 60) private String category;

    @Column(name = "created_by_user_id", nullable = false) private Long createdByUserId;

    /** ISO-4217. See the class javadoc for why this is the group's and not the expense's. */
    @Column(nullable = false, length = 3) private String currency = "INR";

    /** Non-null once archived. Mutating endpoints refuse to write into an archived group. */
    @Column(name = "archived_at") private Instant archivedAt;

    @CreationTimestamp @Column(nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp   @Column(nullable = false)                    private Instant updatedAt;

    public boolean isArchived() {
        return archivedAt != null;
    }
}
