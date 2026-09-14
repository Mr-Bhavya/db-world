package com.db.dbworld.app.tally.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * One thing somebody did to a group: what, to which row, and what it looked like before.
 *
 * <p>Append-only, like the ledger. Nothing here is ever updated or deleted — a log you can
 * edit is not a log.
 *
 * <h2>Why the wording is stored rather than rendered</h2>
 * {@link #summary} is written as a finished sentence at the moment the thing happens, naming
 * the amounts and the people <em>as they were then</em>. The alternative — keeping ids and
 * composing the sentence at read time — silently rewrites history: rename a member and every
 * past entry starts claiming somebody else did it, correct an expense and the entry recording
 * the old amount now shows the new one. An audit log that changes when the data changes is
 * worse than none, because it looks authoritative.
 *
 * <p>Same reason {@link #actorName} is a snapshot and not a join.
 */
@Entity
@Table(name = "tally_activity", schema = "db_world",
        indexes = {
            // The group's activity feed, newest first, paged the same way the expense feed is.
            // `id` trailing so the keyset has a total order when several things happen inside
            // the same second -- which they do, because one user action can write several rows.
            @Index(name = "idx_tally_activity_group_at", columnList = "group_id, created_at, id"),
            // "What has happened to this expense" -- the history behind a single row, and what
            // the Restore button on a removed expense is found by.
            @Index(name = "idx_tally_activity_subject", columnList = "subject_type, subject_id")
        })
@Getter @Setter @NoArgsConstructor
public class TallyActivityEntity {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(name = "group_id", nullable = false, length = 36) private String groupId;

    @Column(name = "actor_user_id", nullable = false) private Long actorUserId;

    /** Their name when it happened. Snapshot, not a join — see the class javadoc. */
    @Column(name = "actor_name", nullable = false, length = 120) private String actorName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private TallyActivityAction action;

    @Enumerated(EnumType.STRING)
    @Column(name = "subject_type", nullable = false, length = 20)
    private TallyActivitySubject subjectType;

    /** The expense, settlement or member this was done to. Null when the subject is the group. */
    @Column(name = "subject_id", length = 36) private String subjectId;

    /** A finished sentence: "Corrected Groceries from ₹840.00 to ₹890.00". */
    @Column(nullable = false, length = 300) private String summary;

    /**
     * The before-and-after, one change per line, as plain text.
     *
     * <p>Text rather than JSON on purpose. This is read by people, not parsed — and Spring
     * Boot 4 ships no Jackson-2 {@code ObjectMapper} bean, so a JSON column would mean picking
     * a serialiser to record what is already a handful of human-readable lines.
     */
    @Lob @Column(columnDefinition = "TEXT") private String detail;

    // No updatedAt: the table is append-only, and offering one would invite an UPDATE.
    @CreationTimestamp @Column(nullable = false, updatable = false) private Instant createdAt;
}
