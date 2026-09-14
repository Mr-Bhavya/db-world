package com.db.dbworld.app.tally.service;

import com.db.dbworld.app.tally.dto.CreateExpenseRequest;
import com.db.dbworld.app.tally.dto.CreateExpenseRequest.ParticipantInput;
import com.db.dbworld.app.tally.dto.CreateExpenseRequest.PayerInput;
import com.db.dbworld.app.tally.entity.*;
import com.db.dbworld.app.tally.repository.*;
import com.db.dbworld.core.exception.DbWorldException;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Writing, correcting and voiding expenses.
 *
 * <p>Every write here is one transaction covering four tables — the expense, its payers, its
 * shares and the ledger entries they imply. Splitting that up would let a crash leave an
 * expense with no ledger rows, which reads as a balance that quietly lost money.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class TallyExpenseService {

    private final TallyAccessService access;
    private final TallyLedgerService ledgerService;
    private final TallyExpenseRepository expenses;
    private final TallyExpensePayerRepository payers;
    private final TallyExpenseShareRepository shares;
    private final TallyGroupMemberRepository members;

    /* ============================== create ============================== */

    /**
     * Records an expense and posts it to the ledger.
     *
     * <p>The roster is read <b>inside this transaction</b> and not cached. Delegation is
     * snapshotted onto each share as it is written, so reading a stale roster would snapshot a
     * delegation that had already been changed — and snapshots are never revisited, so it would
     * stay wrong forever.
     */
    @Transactional
    public TallyExpenseEntity create(Long userId, String groupId, CreateExpenseRequest request) {
        access.requireOpenGroup(userId, groupId);

        // Idempotent replay comes first: a retry must return the original, not validate and
        // then collide on the unique key with a 500.
        if (request.idempotencyKey() != null && !request.idempotencyKey().isBlank()) {
            var existing = expenses.findByGroupIdAndIdempotencyKey(groupId, request.idempotencyKey());
            if (existing.isPresent()) {
                log.debug("Replaying expense {} for idempotency key {}", existing.get().getId(),
                        request.idempotencyKey());
                return existing.get();
            }
        }

        Map<String, TallyGroupMemberEntity> roster = members.findByGroupIdAndStatus(groupId, TallyMemberStatus.ACTIVE)
                .stream().collect(Collectors.toMap(TallyGroupMemberEntity::getId, Function.identity()));

        requireKnownMembers(roster, request);

        TallyExpenseEntity expense = new TallyExpenseEntity();
        expense.setGroupId(groupId);
        expense.setDescription(request.description().trim());
        expense.setTotalAmount(request.totalAmount());
        expense.setDivisionMethod(request.divisionMethod());
        expense.setCategory(blankToNull(request.category()));
        expense.setExpenseDate(request.expenseDate());
        expense.setCreatedByUserId(userId);
        expense.setNotes(blankToNull(request.notes()));
        expense.setIdempotencyKey(blankToNull(request.idempotencyKey()));
        expenses.save(expense);

        List<TallyExpensePayerEntity> payerRows = buildPayers(expense, request.payers());
        List<TallyExpenseShareEntity> shareRows = buildShares(expense, request, roster);

        payers.saveAll(payerRows);
        shares.saveAll(shareRows);
        ledgerService.postExpense(expense, payerRows, shareRows);

        return expense;
    }

    /* ============================== void ============================== */

    /**
     * Voids an expense: flags it and reverses its ledger entries.
     *
     * <p>Nothing is deleted. The shares and payers stay exactly as written so the expense can
     * still be opened and read — "who was at that dinner" is a question people ask about
     * expenses that turned out to be wrong, and it is the reversal that makes the money
     * disappear, not the row.
     *
     * <p>Anyone may void their own; voiding somebody else's needs the owner role.
     */
    @Transactional
    public TallyExpenseEntity voidExpense(Long userId, String expenseId) {
        TallyExpenseEntity expense = expenses.findById(expenseId)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "Expense not found"));
        access.requireOpenGroup(userId, expense.getGroupId());

        if (!expense.getCreatedByUserId().equals(userId)) {
            access.requireOwner(userId, expense.getGroupId());
        }
        if (!expense.isActive()) {
            throw new DbWorldException(HttpStatus.CONFLICT, "This expense has already been voided");
        }

        expense.setStatus(TallyExpenseStatus.VOIDED);
        ledgerService.reverse(TallyLedgerSourceType.EXPENSE, expense.getId());
        return expense;
    }

    /**
     * Corrects an expense by voiding it and posting a replacement.
     *
     * <p>Never an UPDATE. The ledger is append-only and already carries entries describing an
     * allocation of the old total; editing the expense underneath them would leave the two
     * describing different facts, with no record that anything changed. Void-and-repost keeps
     * the history honest — the group can see that the number was corrected, and when.
     */
    @Transactional
    public TallyExpenseEntity replace(Long userId, String expenseId, CreateExpenseRequest request) {
        TallyExpenseEntity original = expenses.findById(expenseId)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "Expense not found"));
        voidExpense(userId, expenseId);

        // The replacement cannot reuse the original's idempotency key -- it is still on the
        // voided row, and the unique key is per group, not per live row.
        CreateExpenseRequest replacement = request.idempotencyKey() == null ? request
                : new CreateExpenseRequest(request.description(), request.totalAmount(),
                        request.divisionMethod(), request.category(), request.expenseDate(),
                        request.notes(), null, request.payers(), request.participants());

        return create(userId, original.getGroupId(), replacement);
    }

    /* ============================== building rows ============================== */

    private List<TallyExpensePayerEntity> buildPayers(TallyExpenseEntity expense, List<PayerInput> inputs) {
        Set<String> seen = new HashSet<>();
        List<TallyExpensePayerEntity> rows = new ArrayList<>(inputs.size());
        for (PayerInput in : inputs) {
            if (!seen.add(in.memberId())) {
                // The unique key would catch this, but as a 500 from a constraint violation.
                throw new DbWorldException(HttpStatus.BAD_REQUEST,
                        "The same person is listed twice as a payer");
            }
            TallyExpensePayerEntity p = new TallyExpensePayerEntity();
            p.setExpenseId(expense.getId());
            p.setMemberId(in.memberId());
            p.setAmount(in.amount());
            rows.add(p);
        }
        return rows;
    }

    /**
     * Turns the split method into exact amounts, then snapshots who is liable for each.
     *
     * <p>All four methods go through {@link TallyAllocator} — including EXACT, which might look
     * like it needs no arithmetic. It does not need dividing, but it does need the same
     * validation, and routing it down a separate path is how the one method that skips the
     * "does this add up" check gets written.
     */
    private List<TallyExpenseShareEntity> buildShares(TallyExpenseEntity expense,
                                                      CreateExpenseRequest request,
                                                      Map<String, TallyGroupMemberEntity> roster) {
        List<ParticipantInput> participants = request.participants();
        Set<String> seen = new HashSet<>();
        for (ParticipantInput p : participants) {
            if (!seen.add(p.memberId())) {
                throw new DbWorldException(HttpStatus.BAD_REQUEST,
                        "The same person is listed twice in the split");
            }
        }

        BigDecimal total = expense.getTotalAmount();
        List<TallyAllocator.Allocation> amounts = switch (request.divisionMethod()) {
            case EQUAL -> TallyAllocator.allocateEqually(total,
                    participants.stream().map(ParticipantInput::memberId).toList());

            case EXACT -> {
                // Nothing is divided here, so the "do these add up" check is the only thing
                // standing between a typo and an expense whose parts do not equal its whole.
                BigDecimal sum = participants.stream()
                        .map(p -> requirePresent(p.exactAmount(), "an amount", p.memberId()))
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                if (sum.compareTo(total) != 0) {
                    throw new DbWorldException(HttpStatus.BAD_REQUEST,
                            "The amounts add up to %s, but the expense is %s".formatted(sum, total));
                }
                yield participants.stream()
                        .map(p -> new TallyAllocator.Allocation(p.memberId(), p.exactAmount()))
                        .toList();
            }

            case PERCENT -> {
                BigDecimal sum = participants.stream()
                        .map(p -> requirePresent(p.percent(), "a percentage", p.memberId()))
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                if (sum.compareTo(new BigDecimal("100")) != 0) {
                    throw new DbWorldException(HttpStatus.BAD_REQUEST,
                            "Percentages must add up to 100, not " + sum.stripTrailingZeros().toPlainString());
                }
                // Percentages are weights: the allocator turns them into rupees that sum
                // exactly, which multiplying each share out separately would not.
                yield TallyAllocator.allocate(total, participants.stream()
                        .map(p -> new TallyAllocator.Weight(p.memberId(), p.percent()))
                        .toList());
            }

            case SHARES -> yieldShares(total, participants);
        };

        Map<String, BigDecimal> byMember = amounts.stream()
                .collect(Collectors.toMap(TallyAllocator.Allocation::memberId, TallyAllocator.Allocation::amount));

        List<TallyExpenseShareEntity> rows = new ArrayList<>(participants.size());
        for (ParticipantInput p : participants) {
            TallyExpenseShareEntity s = new TallyExpenseShareEntity();
            s.setExpenseId(expense.getId());
            s.setBeneficiaryMemberId(p.memberId());
            s.setOwedByMemberId(resolveLiability(p, roster));
            s.setAmount(byMember.get(p.memberId()));
            s.setSharePercent(p.percent());
            s.setShareWeight(p.shareWeight());
            rows.add(s);
        }
        return rows;
    }

    private static List<TallyAllocator.Allocation> yieldShares(BigDecimal total, List<ParticipantInput> participants) {
        List<TallyAllocator.Weight> weights = participants.stream()
                .map(p -> new TallyAllocator.Weight(p.memberId(),
                        requirePresent(p.shareWeight(), "a number of shares", p.memberId())))
                .toList();
        return TallyAllocator.allocate(total, weights);
    }

    /**
     * Who owes this share: the explicit override if one was sent, otherwise the member's
     * standing delegation, otherwise themselves.
     *
     * <p>This is the snapshot. Once written it is never revisited, which is what makes changing
     * a standing delegation safe — last month's groceries keep the answer that was true when
     * they were bought.
     */
    private String resolveLiability(ParticipantInput p, Map<String, TallyGroupMemberEntity> roster) {
        if (p.owedByMemberId() != null && !p.owedByMemberId().isBlank()) {
            if (!roster.containsKey(p.owedByMemberId())) {
                throw new DbWorldException(HttpStatus.BAD_REQUEST,
                        "Cannot make somebody outside this group liable for a share");
            }
            return p.owedByMemberId();
        }
        String standing = roster.get(p.memberId()).getPaidForByMemberId();
        return standing != null ? standing : p.memberId();
    }

    /* ============================== validation ============================== */

    private static void requireKnownMembers(Map<String, TallyGroupMemberEntity> roster,
                                            CreateExpenseRequest request) {
        // Plain id columns mean Hibernate emits no foreign keys, so nothing below this line
        // would stop an expense referencing a member of somebody else's group.
        List<String> referenced = new ArrayList<>();
        request.payers().forEach(p -> referenced.add(p.memberId()));
        request.participants().forEach(p -> referenced.add(p.memberId()));

        List<String> unknown = referenced.stream().distinct().filter(id -> !roster.containsKey(id)).sorted().toList();
        if (!unknown.isEmpty()) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST,
                    "Not an active member of this group: " + String.join(", ", unknown));
        }
    }

    private static BigDecimal requirePresent(BigDecimal value, String what, String memberId) {
        if (value == null) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST,
                    "This split needs %s for every person, and one is missing for %s".formatted(what, memberId));
        }
        return value;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
