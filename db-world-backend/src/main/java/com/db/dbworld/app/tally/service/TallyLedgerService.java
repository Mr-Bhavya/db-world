package com.db.dbworld.app.tally.service;

import com.db.dbworld.app.tally.entity.*;
import com.db.dbworld.app.tally.repository.TallyLedgerEntryRepository;
import com.db.dbworld.core.exception.DbWorldException;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Turns expenses and settlements into "who owes whom" edges.
 *
 * <p>Shares and payers are the source of truth; this writes the projection, in the same
 * transaction, and nothing else may write to {@code tally_ledger_entry}.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class TallyLedgerService {

    private final TallyLedgerEntryRepository ledger;

    /* ============================== expenses ============================== */

    /**
     * Posts an expense: every debtor's liability, spread across the people who actually paid.
     *
     * <h2>The allocation</h2>
     * A debtor owes their total to the payers in proportion to what each payer put in. With one
     * payer that is the whole amount; with two it has to be divided, and dividing money is
     * where paise go missing — so it runs through {@link TallyAllocator} exactly like the
     * original split did. <b>Two payers means the rounding happens twice</b>, once splitting
     * the bill and once splitting each debt across the payers, which is precisely why the
     * allocator is used on both passes rather than only the obvious one.
     *
     * <p>Shares are aggregated <em>by debtor</em> before allocating, rather than allocated one
     * share at a time. Delegation makes that matter: three children's shares all owed by one
     * parent become a single 300-rupee debt divided once, instead of three 100-rupee debts each
     * rounded separately. Fewer divisions, less rounding, and the result still sums exactly.
     *
     * <p>Everything is sorted by member id before it is used — debtors, payers, and the
     * allocator's own tie-break. Insertion order must never reach the arithmetic: a re-post
     * that disagreed with its original by a paisa would be written into an append-only table.
     *
     * <p>Self-edges are dropped <b>after</b> allocation, never before. The portion a debtor owes
     * themselves is real — it is the part of the bill they funded — and removing it from the
     * weights beforehand would redistribute it to the other payers and overstate the debt.
     */
    @Transactional
    public List<TallyLedgerEntryEntity> postExpense(TallyExpenseEntity expense,
                                                    List<TallyExpensePayerEntity> payers,
                                                    List<TallyExpenseShareEntity> shares) {
        requireSumsTo(expense.getTotalAmount(), payers.stream().map(TallyExpensePayerEntity::getAmount).toList(),
                "payments");
        requireSumsTo(expense.getTotalAmount(), shares.stream().map(TallyExpenseShareEntity::getAmount).toList(),
                "shares");

        // TreeMap, so the iteration order is member id and not whatever the caller built.
        Map<String, BigDecimal> debts = new TreeMap<>();
        for (TallyExpenseShareEntity s : shares) {
            debts.merge(s.getOwedByMemberId(), s.getAmount(), BigDecimal::add);
        }

        List<TallyAllocator.Weight> payerWeights = payers.stream()
                .sorted(Comparator.comparing(TallyExpensePayerEntity::getMemberId))
                .map(p -> new TallyAllocator.Weight(p.getMemberId(), p.getAmount()))
                .toList();

        Map<Edge, BigDecimal> edges = new LinkedHashMap<>();
        debts.forEach((debtorId, owed) -> {
            if (owed.signum() == 0) {
                return;
            }
            for (TallyAllocator.Allocation a : TallyAllocator.allocate(owed, payerWeights)) {
                if (a.memberId().equals(debtorId) || a.amount().signum() == 0) {
                    continue;   // self-funded portion, or a payer who contributed nothing
                }
                edges.merge(new Edge(debtorId, a.memberId()), a.amount(), BigDecimal::add);
            }
        });

        return write(expense.getGroupId(), TallyLedgerSourceType.EXPENSE, expense.getId(),
                TallyLedgerEntryType.ORIGINAL, edges);
    }

    /* ============================== settlements ============================== */

    /**
     * Posts a payment. <b>The edge runs backwards from the settlement, and that is correct.</b>
     *
     * <p>A settlement row says "A paid B". A ledger edge says "from owes to". Handing over cash
     * does not create a debt for the payer — it creates a claim <em>against</em> the person who
     * received it, which is what cancels the debt that prompted the payment. So a settlement
     * {@code A -> B} becomes the edge {@code B owes A}.
     *
     * <p>Worth spelling out because inverting it is silent: balances still move, just twice as
     * far in the wrong direction, and the group discovers it when settling up makes the debt
     * bigger.
     */
    @Transactional
    public List<TallyLedgerEntryEntity> postSettlement(TallySettlementEntity settlement) {
        requirePositive(settlement.getAmount());
        requireDistinct(settlement.getFromMemberId(), settlement.getToMemberId());

        Map<Edge, BigDecimal> edges = Map.of(
                new Edge(settlement.getToMemberId(), settlement.getFromMemberId()),
                settlement.getAmount());

        return write(settlement.getGroupId(), TallyLedgerSourceType.SETTLEMENT, settlement.getId(),
                TallyLedgerEntryType.ORIGINAL, edges);
    }

    /* ============================== reversal ============================== */

    /**
     * Undoes everything a source posted, by writing each of its entries back with {@code from}
     * and {@code to} swapped.
     *
     * <p>Reading the original rows rather than recomputing them is the point. Re-running the
     * allocator would give the same answer today — it is deterministic precisely so that it
     * would — but "the same answer" is an assumption that has to hold across every future
     * change to the allocation rules, for rows written by versions of the code that no longer
     * exist. Copying and swapping cannot drift, because there is nothing to drift from.
     *
     * <p>Reversing twice is refused rather than tolerated: the second pass would find four
     * entries, reverse all of them, and leave the balance where it started while the history
     * suggested two undos.
     */
    @Transactional
    public List<TallyLedgerEntryEntity> reverse(TallyLedgerSourceType sourceType, String sourceId) {
        List<TallyLedgerEntryEntity> existing = ledger.findBySourceTypeAndSourceId(sourceType, sourceId);
        if (existing.stream().anyMatch(e -> e.getEntryType() == TallyLedgerEntryType.REVERSAL)) {
            throw new DbWorldException(HttpStatus.CONFLICT, "This has already been reversed");
        }

        List<TallyLedgerEntryEntity> reversals = existing.stream().map(original -> {
            TallyLedgerEntryEntity r = new TallyLedgerEntryEntity();
            r.setGroupId(original.getGroupId());
            r.setFromMemberId(original.getToMemberId());
            r.setToMemberId(original.getFromMemberId());
            r.setAmount(original.getAmount());
            r.setSourceType(original.getSourceType());
            r.setSourceId(original.getSourceId());
            r.setEntryType(TallyLedgerEntryType.REVERSAL);
            return r;
        }).toList();

        return ledger.saveAll(reversals);
    }

    /* ============================== internals ============================== */

    /** A directed debt, used to collapse edges that arise more than once in one posting. */
    private record Edge(String from, String to) {}

    private List<TallyLedgerEntryEntity> write(String groupId, TallyLedgerSourceType sourceType,
                                               String sourceId, TallyLedgerEntryType entryType,
                                               Map<Edge, BigDecimal> edges) {
        List<TallyLedgerEntryEntity> rows = new ArrayList<>(edges.size());
        edges.forEach((edge, amount) -> {
            requirePositive(amount);
            requireDistinct(edge.from(), edge.to());

            TallyLedgerEntryEntity e = new TallyLedgerEntryEntity();
            e.setGroupId(groupId);
            e.setFromMemberId(edge.from());
            e.setToMemberId(edge.to());
            e.setAmount(amount);
            e.setSourceType(sourceType);
            e.setSourceId(sourceId);
            e.setEntryType(entryType);
            rows.add(e);
        });
        return ledger.saveAll(rows);
    }

    /**
     * Refuses to write anything if the parts do not add up to the whole.
     *
     * <p>Checked before the first INSERT, not after. The common failure is not rounding — it is
     * a client sending an EXACT split whose amounts simply do not sum to the total, and half of
     * that expense on disk is worse than none of it.
     */
    private static void requireSumsTo(BigDecimal total, List<BigDecimal> parts, String what) {
        if (parts.isEmpty()) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "An expense needs at least one of: " + what);
        }
        BigDecimal sum = parts.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        if (sum.compareTo(total) != 0) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST,
                    "The %s add up to %s, but the expense is %s".formatted(what, sum, total));
        }
    }

    private static void requirePositive(BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Amount must be more than zero");
        }
    }

    private static void requireDistinct(String from, String to) {
        if (from.equals(to)) {
            // Direction is the only thing carrying meaning here, so an edge with none is not a
            // zero-value fact worth storing -- it is a bug upstream.
            throw new IllegalStateException("Refusing to write a ledger entry from a member to themselves");
        }
    }
}
