package com.db.dbworld.app.tally.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * One participant in a group — either a db-world user or a "ghost": a name with no account,
 * for the family member who is never going to sign up.
 *
 * <p>Everything else in the module references the member <em>id</em>, never the user id, so a
 * ghost is a first-class participant: it can pay, owe, be settled with, and later be claimed by
 * a real account without any of its history moving.
 *
 * <h2>Delegation — {@link #paidForByMemberId}</h2>
 * The point of the module that Splitwise cannot express: <em>who consumed</em> and <em>who is
 * liable</em> are different questions. A parent pays for the children's share of the groceries
 * while the flatmate pays their own. This column is the member's <b>standing default</b>; every
 * expense snapshots the resolved answer into its share rows at write time, so changing the
 * default here never rewrites history. The graph is kept a depth-1 forest, enforced when the
 * delegation is set rather than when an expense is written — cycle detection at write time would
 * otherwise surface as an innocent third party's expense throwing.
 */
@Entity
@Table(name = "tally_group_member", schema = "db_world",
        uniqueConstraints = {
            // One membership per real user per group. Ghosts coexist freely underneath this key
            // only because InnoDB treats NULLs as distinct, so any number of rows may hold
            // (group_id, NULL) -- which is exactly what makes "three unnamed kids" expressible.
            // That behaviour is load-bearing and invisible from the annotation alone.
            @UniqueConstraint(name = "uk_tally_group_member_group_user",
                    columnNames = {"group_id", "user_id"})
        },
        indexes = {
            // "every group I am in" -- the landing query for the whole app. The unique key above
            // leads with group_id so it cannot serve this, and without this index the home screen
            // table-scans every membership row in the system.
            @Index(name = "idx_tally_group_member_user", columnList = "user_id, group_id"),
            // Roster read, and the removal sweep that clears inbound delegations.
            @Index(name = "idx_tally_group_member_group", columnList = "group_id, status"),
            @Index(name = "idx_tally_group_member_delegate", columnList = "paid_for_by_member_id")
        })
@Getter @Setter @NoArgsConstructor
public class TallyGroupMemberEntity {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(name = "group_id", nullable = false, length = 36) private String groupId;

    /** Null for a ghost. Set only by the claim flow, which is a merge — see the service. */
    @Column(name = "user_id") private Long userId;

    /** Shown everywhere. For a real user this is seeded from their account but stays editable. */
    @Column(name = "display_name", nullable = false, length = 120) private String displayName;

    /** Optional, and only a hint for inviting a ghost later; never used to match accounts. */
    @Column(length = 190) private String email;

    /**
     * Standing default for who settles this member's shares, or null for "themselves".
     * Self-referencing within the same group — see the class javadoc.
     */
    @Column(name = "paid_for_by_member_id", length = 36) private String paidForByMemberId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TallyMemberRole role = TallyMemberRole.MEMBER;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TallyMemberStatus status = TallyMemberStatus.ACTIVE;

    @CreationTimestamp @Column(nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp   @Column(nullable = false)                    private Instant updatedAt;

    public boolean isGhost() {
        return userId == null;
    }

    public boolean isActive() {
        return status == TallyMemberStatus.ACTIVE;
    }
}
