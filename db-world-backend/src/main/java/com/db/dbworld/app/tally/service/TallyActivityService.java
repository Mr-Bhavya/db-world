package com.db.dbworld.app.tally.service;

import com.db.dbworld.app.tally.dto.TallyActivityDto;
import com.db.dbworld.app.tally.dto.TallyActivityPageDto;
import com.db.dbworld.app.tally.entity.*;
import com.db.dbworld.app.tally.repository.TallyActivityRepository;
import com.db.dbworld.app.tally.repository.TallyGroupMemberRepository;
import com.db.dbworld.core.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.HashSet;
import java.util.Set;
import java.util.ArrayList;
import java.util.List;

/**
 * Writes down who did what.
 *
 * <h2>Written in the same transaction as the thing it records</h2>
 * Not after commit, and not from an event listener. If the log write fails the action fails
 * with it — which is the right trade for an audit log, because the alternative is an action
 * that succeeded with no record of it, and a log with silent holes is worse than no log: you
 * cannot tell the holes from the quiet periods.
 *
 * <h2>Sentences, not data</h2>
 * Every entry stores a finished line of prose with the names and amounts as they were at that
 * moment. Composing it at read time from ids would mean renaming a member silently rewrites
 * who did what, and correcting an expense rewrites the entry that recorded the old amount.
 * See {@link TallyActivityEntity}.
 */
@Service
@RequiredArgsConstructor
public class TallyActivityService {

    private final TallyActivityRepository activity;
    private final TallyGroupMemberRepository members;
    private final UserRepository users;

    /**
     * A clock that never returns the same instant twice.
     *
     * <p>The feed is ordered by {@code created_at} and only then by id, and the id is a random
     * UUID — so two rows sharing a timestamp come back in arbitrary order. That is not a corner
     * case here: one user action routinely writes several rows in one transaction, and
     * {@code @CreationTimestamp} would stamp them all identically. A correction writing two
     * entries, or adding a member and then an expense, would read back shuffled.
     *
     * <p>Bumping by a microsecond when the clock has not moved keeps the ordering honest
     * without a sequence column. It is per-instance rather than global, which is the right
     * scope: two instances writing to one group inside the same microsecond is both vanishingly
     * unlikely and genuinely ambiguous.
     */
    private final AtomicReference<Instant> lastStamp = new AtomicReference<>(Instant.EPOCH);

    private Instant nextStamp() {
        return lastStamp.updateAndGet(previous -> {
            Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
            return now.isAfter(previous) ? now : previous.plus(1, ChronoUnit.MICROS);
        });
    }

    private static final int DEFAULT_PAGE_SIZE = 40;
    private static final int MAX_PAGE_SIZE = 150;

    /* ============================== reading ============================== */

    /**
     * A page of the group's history, newest first.
     *
     * <p>Access is the caller's to have already checked — this is called from services that
     * have. It reads {@code archivedAt}-blind on purpose: an archived group's history is the
     * main reason to keep the group at all.
     */
    @Transactional(readOnly = true)
    public TallyActivityPageDto list(String groupId, Instant cursorAt, String cursorId, Integer size) {
        int limit = Math.clamp(size == null ? DEFAULT_PAGE_SIZE : size, 1, MAX_PAGE_SIZE);
        var probe = Limit.of(limit + 1);

        var rows = (cursorAt == null || cursorId == null)
                ? activity.findFirstPage(groupId, probe)
                : activity.findPageAfter(groupId, cursorAt, cursorId, probe);

        boolean hasMore = rows.size() > limit;
        var page = hasMore ? rows.subList(0, limit) : rows;

        // Which removed expenses have already been put back, in one query for the page rather
        // than one per row -- a history screen is the last place to introduce an N+1.
        Set<String> restored = new HashSet<>(activity.findRestoredSubjectIds(groupId));

        var items = page.stream().map(row -> new TallyActivityDto(
                row.getId(), row.getAction(), row.getSubjectType(), row.getSubjectId(),
                row.getActorName(), row.getSummary(), row.getDetail(),
                row.getAction() == TallyActivityAction.EXPENSE_REMOVED
                        && row.getSubjectId() != null
                        && !restored.contains(row.getSubjectId()),
                row.getCreatedAt())).toList();

        var last = hasMore ? page.getLast() : null;
        return new TallyActivityPageDto(items,
                last == null ? null : last.getCreatedAt(),
                last == null ? null : last.getId(),
                hasMore);
    }

    /* ============================== groups ============================== */

    @Transactional
    public void groupCreated(TallyGroupEntity group, Long actor) {
        write(group.getId(), actor, TallyActivityAction.GROUP_CREATED, TallyActivitySubject.GROUP,
                null, "Created %s".formatted(group.getName()), null);
    }

    @Transactional
    public void groupUpdated(TallyGroupEntity group, Long actor, Changes changes) {
        if (changes.isEmpty()) return;   // a PATCH that changed nothing is not an event
        write(group.getId(), actor, TallyActivityAction.GROUP_UPDATED, TallyActivitySubject.GROUP,
                null, "Updated %s".formatted(group.getName()), changes.render());
    }

    @Transactional
    public void groupArchived(TallyGroupEntity group, Long actor, boolean archived) {
        write(group.getId(), actor,
                archived ? TallyActivityAction.GROUP_ARCHIVED : TallyActivityAction.GROUP_REOPENED,
                TallyActivitySubject.GROUP, null,
                "%s %s".formatted(archived ? "Archived" : "Reopened", group.getName()), null);
    }

    /* ============================== members ============================== */

    @Transactional
    public void memberAdded(String groupId, TallyGroupMemberEntity member, Long actor, boolean rejoined) {
        write(groupId, actor,
                rejoined ? TallyActivityAction.MEMBER_REJOINED : TallyActivityAction.MEMBER_ADDED,
                TallyActivitySubject.MEMBER, member.getId(),
                rejoined
                        ? "%s rejoined".formatted(member.getDisplayName())
                        : "Added %s%s".formatted(member.getDisplayName(),
                                member.isGhost() ? " (no account)" : ""),
                null);
    }

    @Transactional
    public void memberUpdated(String groupId, TallyGroupMemberEntity member, Long actor, Changes changes) {
        if (changes.isEmpty()) return;
        write(groupId, actor, TallyActivityAction.MEMBER_UPDATED, TallyActivitySubject.MEMBER,
                member.getId(), "Updated %s".formatted(member.getDisplayName()), changes.render());
    }

    @Transactional
    public void delegationChanged(String groupId, TallyGroupMemberEntity member, String payerName,
                                  Long actor) {
        boolean set = payerName != null;
        write(groupId, actor,
                set ? TallyActivityAction.DELEGATION_SET : TallyActivityAction.DELEGATION_CLEARED,
                TallyActivitySubject.MEMBER, member.getId(),
                set
                        ? "%s now pays for %s".formatted(payerName, member.getDisplayName())
                        : "%s now pays for themselves".formatted(member.getDisplayName()),
                null);
    }

    @Transactional
    public void memberRemoved(String groupId, TallyGroupMemberEntity member, Long actor, boolean self) {
        write(groupId, actor, TallyActivityAction.MEMBER_REMOVED, TallyActivitySubject.MEMBER,
                member.getId(),
                self ? "%s left".formatted(member.getDisplayName())
                     : "Removed %s".formatted(member.getDisplayName()),
                null);
    }

    @Transactional
    public void memberClaimed(String groupId, TallyGroupMemberEntity survivor, String ghostName,
                              Long actor) {
        write(groupId, actor, TallyActivityAction.MEMBER_CLAIMED, TallyActivitySubject.MEMBER,
                survivor.getId(),
                "%s took over %s".formatted(survivor.getDisplayName(), ghostName),
                "%s had no account; their history now belongs to %s"
                        .formatted(ghostName, survivor.getDisplayName()));
    }

    /* ============================== expenses ============================== */

    @Transactional
    public void expenseAdded(TallyExpenseEntity expense, Long actor) {
        write(expense.getGroupId(), actor, TallyActivityAction.EXPENSE_ADDED,
                TallyActivitySubject.EXPENSE, expense.getId(),
                "Added %s for %s".formatted(expense.getDescription(), money(expense.getTotalAmount())),
                null);
    }

    @Transactional
    public void expenseCorrected(TallyExpenseEntity original, TallyExpenseEntity replacement, Long actor) {
        // Recorded against the REPLACEMENT, and against the original too, so the history reads
        // correctly from either end: opening the old row shows it was corrected, opening the
        // new one shows what it replaced.
        String line = "Corrected %s from %s to %s".formatted(
                original.getDescription(), money(original.getTotalAmount()),
                money(replacement.getTotalAmount()));
        var changes = new Changes()
                .add("Description", original.getDescription(), replacement.getDescription())
                .add("Amount", money(original.getTotalAmount()), money(replacement.getTotalAmount()))
                .add("Date", String.valueOf(original.getExpenseDate()),
                        String.valueOf(replacement.getExpenseDate()))
                .add("Split", original.getDivisionMethod().name(),
                        replacement.getDivisionMethod().name());

        write(original.getGroupId(), actor, TallyActivityAction.EXPENSE_CORRECTED,
                TallyActivitySubject.EXPENSE, replacement.getId(), line, changes.render());
        write(original.getGroupId(), actor, TallyActivityAction.EXPENSE_CORRECTED,
                TallyActivitySubject.EXPENSE, original.getId(), line, changes.render());
    }

    @Transactional
    public void expenseRemoved(TallyExpenseEntity expense, Long actor) {
        write(expense.getGroupId(), actor, TallyActivityAction.EXPENSE_REMOVED,
                TallyActivitySubject.EXPENSE, expense.getId(),
                "Removed %s (%s)".formatted(expense.getDescription(), money(expense.getTotalAmount())),
                null);
    }

    @Transactional
    public void expenseRestored(TallyExpenseEntity original, TallyExpenseEntity copy, Long actor) {
        String line = "Restored %s (%s)".formatted(copy.getDescription(), money(copy.getTotalAmount()));
        write(copy.getGroupId(), actor, TallyActivityAction.EXPENSE_RESTORED,
                TallyActivitySubject.EXPENSE, copy.getId(), line,
                "Put back from a removed expense recorded on " + original.getExpenseDate());
        // Also against the original, which is what the Restore button checks to know it is done.
        write(original.getGroupId(), actor, TallyActivityAction.EXPENSE_RESTORED,
                TallyActivitySubject.EXPENSE, original.getId(), line, null);
    }

    /* ============================== settlements ============================== */

    @Transactional
    public void settlementRecorded(TallySettlementEntity settlement, String fromName, String toName,
                                   Long actor) {
        write(settlement.getGroupId(), actor, TallyActivityAction.SETTLEMENT_RECORDED,
                TallyActivitySubject.SETTLEMENT, settlement.getId(),
                "%s paid %s %s".formatted(fromName, toName, money(settlement.getAmount())),
                settlement.getMethod() == null ? null : "by " + settlement.getMethod());
    }

    @Transactional
    public void settlementReversed(TallySettlementEntity settlement, String fromName, String toName,
                                   Long actor) {
        write(settlement.getGroupId(), actor, TallyActivityAction.SETTLEMENT_REVERSED,
                TallyActivitySubject.SETTLEMENT, settlement.getId(),
                "Took back %s paid by %s to %s"
                        .formatted(money(settlement.getAmount()), fromName, toName),
                null);
    }

    /* ============================== internals ============================== */

    private void write(String groupId, Long actorUserId, TallyActivityAction action,
                       TallyActivitySubject subjectType, String subjectId,
                       String summary, String detail) {
        var entry = new TallyActivityEntity();
        entry.setGroupId(groupId);
        entry.setActorUserId(actorUserId);
        entry.setActorName(actorName(groupId, actorUserId));
        entry.setAction(action);
        entry.setSubjectType(subjectType);
        entry.setSubjectId(subjectId);
        entry.setSummary(trim(summary, 300));
        entry.setDetail(detail);
        entry.setCreatedAt(nextStamp());
        activity.save(entry);
    }

    /**
     * The actor's name as it stands right now, frozen into the row.
     *
     * <p>Their membership name first, because that is what everyone else in the group sees
     * them as; their account name only as a fallback, for the moment before their member row
     * exists — creating a group is logged before anybody is looking at the roster.
     */
    private String actorName(String groupId, Long userId) {
        return members.findByGroupIdAndUserId(groupId, userId)
                .map(TallyGroupMemberEntity::getDisplayName)
                .or(() -> users.findById(userId).map(TallyGroupService::fullNameOf))
                .filter(name -> !name.isBlank())
                .orElse("Someone");
    }

    private static String money(BigDecimal amount) {
        return "₹" + (amount == null ? "0.00" : amount.toPlainString());
    }

    private static String trim(String value, int max) {
        return value != null && value.length() > max ? value.substring(0, max - 1) + "…" : value;
    }

    /**
     * A before-and-after list, rendered as one line per field that actually moved.
     *
     * <p>Only differences are kept. A PATCH usually carries every field whether or not the
     * user touched it, and "Name: Home → Home" in an audit log is noise that makes the real
     * change harder to spot.
     */
    public static final class Changes {
        private final List<String> lines = new ArrayList<>();

        public Changes add(String field, String before, String after) {
            String from = before == null ? "—" : before;
            String to = after == null ? "—" : after;
            if (!from.equals(to)) {
                lines.add("%s: %s → %s".formatted(field, from, to));
            }
            return this;
        }

        public boolean isEmpty() {
            return lines.isEmpty();
        }

        public String render() {
            return lines.isEmpty() ? null : String.join("\n", lines);
        }
    }
}
