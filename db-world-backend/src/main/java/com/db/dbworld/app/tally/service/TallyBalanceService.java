package com.db.dbworld.app.tally.service;

import com.db.dbworld.app.tally.dto.SettleUpTransferDto;
import com.db.dbworld.app.tally.entity.TallyGroupMemberEntity;
import com.db.dbworld.app.tally.mapper.TallyMapper;
import com.db.dbworld.app.tally.repository.TallyExpensePayerRepository;
import com.db.dbworld.app.tally.repository.TallyGroupMemberRepository;
import com.db.dbworld.app.tally.repository.TallyExpenseShareRepository;
import com.db.dbworld.app.tally.repository.TallyLedgerEntryRepository;
import com.db.dbworld.app.tally.repository.TallyLedgerEntryRepository.MemberTotal;
import com.db.dbworld.app.tally.repository.TallySettlementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * Who is up and who is down, and the shortest sensible way to square it.
 */
@Service
@RequiredArgsConstructor
public class TallyBalanceService {

    private final TallyLedgerEntryRepository ledger;
    private final TallyExpensePayerRepository payers;
    private final TallyExpenseShareRepository shares;
    private final TallySettlementRepository settlements;
    private final TallyGroupMemberRepository members;
    private final TallyMapper mapper;

    /**
     * Every member's net position: positive means the group owes them.
     *
     * <p>Read from the ledger, always, never recomputed from shares. The ledger already holds
     * the pro-rata choice that multi-payer expenses require, and recomputing risks answering
     * with today's algorithm for rows written by yesterday's.
     *
     * <p>Members who are square are <b>absent, not zero</b> — as is anyone with no activity at
     * all. Callers join this onto the roster, which is the only thing that knows who should
     * appear on screen. Keeping "settled" and "never involved" indistinguishable here is
     * deliberate: both mean nothing is owed, and the alternative is every caller filtering
     * zeroes back out before it can ask whether the group is clear.
     */
    @Transactional(readOnly = true)
    public Map<String, BigDecimal> balances(String groupId) {
        Map<String, BigDecimal> net = new TreeMap<>();
        ledger.sumCreditsByGroup(groupId)
                .forEach(t -> net.merge(t.getMemberId(), t.getTotal(), BigDecimal::add));
        ledger.sumDebitsByGroup(groupId)
                .forEach(t -> net.merge(t.getMemberId(), t.getTotal().negate(), BigDecimal::add));
        net.values().removeIf(v -> v.signum() == 0);
        return net;
    }

    /**
     * One member's net position, as a plain number rather than a map lookup.
     *
     * <p>Two callers need exactly this and nothing else: the group list, which shows the caller
     * where they stand in each group, and member removal, which has to prove the number is
     * exactly zero before letting anybody go. Never null — a member with no activity nets to
     * zero, and the removal guard would otherwise have a null to trip over on the one check
     * standing between a departing member and money disappearing.
     */
    @Transactional(readOnly = true)
    public BigDecimal netOf(String groupId, String memberId) {
        BigDecimal net = ledger.netBalanceOf(groupId, memberId);
        return net == null ? BigDecimal.ZERO : net;
    }

    /**
     * Suggested payments that clear the group, largest debtor against largest creditor.
     *
     * <p><b>This never writes anything.</b> Splitwise's equivalent rewrites who owes whom, which
     * is how you end up being told to "settle up with Carol" when you have never borrowed from
     * Carol. Keeping the true pairwise ledger and offering the plan as advice preserves the
     * answer to "why do I owe this", which is the question people actually ask.
     *
     * <p>Greedy, not optimal: minimising the number of transfers is NP-hard — it reduces to
     * partition — so this takes the standard approximation, which needs at most n−1 transfers
     * and is usually the obvious answer anyway. Ties break on member id so the same balances
     * always produce the same plan; a suggestion that reshuffled between two page loads would
     * look broken.
     */
    @Transactional(readOnly = true)
    public List<SettleUpTransferDto> settleUpPlan(String groupId) {
        Comparator<Map.Entry<String, BigDecimal>> bySizeThenId =
                Comparator.<Map.Entry<String, BigDecimal>, BigDecimal>comparing(e -> e.getValue().abs())
                        .reversed()
                        .thenComparing(Map.Entry::getKey);

        PriorityQueue<Map.Entry<String, BigDecimal>> debtors = new PriorityQueue<>(bySizeThenId);
        PriorityQueue<Map.Entry<String, BigDecimal>> creditors = new PriorityQueue<>(bySizeThenId);

        balances(groupId).forEach((memberId, net) -> {
            if (net.signum() < 0) {
                debtors.add(Map.entry(memberId, net));
            } else if (net.signum() > 0) {
                creditors.add(Map.entry(memberId, net));
            }
        });

        // Loaded unfiltered so a departed member still reads as a person: they can be owed
        // money right up until they are removed, and removal is what requires zero.
        Map<String, String> nameById = members.findByGroupId(groupId).stream()
                .collect(Collectors.toMap(TallyGroupMemberEntity::getId,
                        TallyGroupMemberEntity::getDisplayName));

        List<SettleUpTransferDto> plan = new ArrayList<>();
        while (!debtors.isEmpty() && !creditors.isEmpty()) {
            Map.Entry<String, BigDecimal> debtor = debtors.poll();
            Map.Entry<String, BigDecimal> creditor = creditors.poll();

            BigDecimal amount = debtor.getValue().abs().min(creditor.getValue());
            plan.add(mapper.toTransferDto(
                    debtor.getKey(), nameById.get(debtor.getKey()),
                    creditor.getKey(), nameById.get(creditor.getKey()),
                    amount));

            // Whichever side is not fully cleared goes back in with what is left. Exact
            // BigDecimal arithmetic means a remainder is either a real amount or exactly zero;
            // there is no epsilon to guard against, which is the dividend from doing the
            // rounding properly at write time.
            BigDecimal debtorLeft = debtor.getValue().add(amount);
            BigDecimal creditorLeft = creditor.getValue().subtract(amount);
            if (debtorLeft.signum() < 0) {
                debtors.add(Map.entry(debtor.getKey(), debtorLeft));
            }
            if (creditorLeft.signum() > 0) {
                creditors.add(Map.entry(creditor.getKey(), creditorLeft));
            }
        }
        return plan;
    }

    /**
     * The ledger's balances recomputed from the authoritative tables, for comparison.
     *
     * <p>The ledger is a projection of shares, payers and settlements. This is the formula it
     * is a projection <em>of</em> — what each member put in, less what they are liable for,
     * plus the settlements they have paid and minus the ones they have received. If the two
     * ever disagree, the projection is wrong and every balance in the group is a guess.
     *
     * <p>Lives in main code rather than in the test so it can be asserted anywhere, and because
     * a test-only copy of the formula would drift from the one the service actually means.
     */
    @Transactional(readOnly = true)
    public Map<String, BigDecimal> balancesFromSourceOfTruth(String groupId) {
        Map<String, BigDecimal> net = new TreeMap<>();
        accumulate(net, payers.sumPaidByGroup(groupId), false);
        accumulate(net, shares.sumOwedByGroup(groupId), true);
        // Paying a settlement discharges a debt, so it moves the payer UP; receiving moves the
        // recipient down. Same inversion as the ledger edge, for the same reason.
        accumulate(net, settlements.sumPaidOutByGroup(groupId), false);
        accumulate(net, settlements.sumReceivedByGroup(groupId), true);

        net.values().removeIf(v -> v.signum() == 0);
        return net;
    }

    private static void accumulate(Map<String, BigDecimal> into, List<MemberTotal> rows, boolean negate) {
        rows.forEach(r -> into.merge(r.getMemberId(),
                negate ? r.getTotal().negate() : r.getTotal(), BigDecimal::add));
    }
}
