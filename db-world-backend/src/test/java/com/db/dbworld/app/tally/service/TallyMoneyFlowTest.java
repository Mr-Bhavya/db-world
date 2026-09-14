package com.db.dbworld.app.tally.service;

import com.db.dbworld.app.tally.dto.CreateExpenseRequest;
import com.db.dbworld.app.tally.dto.SettleUpTransferDto;
import com.db.dbworld.app.tally.dto.CreateExpenseRequest.ParticipantInput;
import com.db.dbworld.app.tally.dto.CreateExpenseRequest.PayerInput;
import com.db.dbworld.app.tally.entity.*;
import com.db.dbworld.app.tally.mapper.TallyMapperImpl;
import com.db.dbworld.app.tally.repository.*;
import com.db.dbworld.core.exception.DbWorldException;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.cache.CacheManager;
import org.springframework.cache.support.NoOpCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The module's headline test: money in, money out, and nothing lost on the way.
 *
 * <p>Runs a family group through every split method, a multi-payer expense, a delegated ghost,
 * a void and a settlement — and after <b>every single step</b> asserts the two things that
 * matter:
 *
 * <ol>
 *   <li><b>Reconciliation.</b> The ledger's balances equal the same balances computed from the
 *       authoritative tables ({@code paid − owed ± settlements}). The ledger is a projection,
 *       and a projection that disagrees with its source makes every number in the app a guess.
 *       This is the assertion with teeth — "all balances sum to zero" is true by construction
 *       of the ledger and would pass even if the allocator lost a paisa on every expense.</li>
 *   <li><b>Closure.</b> The group's balances still sum to exactly zero. Weaker than the above,
 *       but it catches a whole class of mistake at a glance.</li>
 * </ol>
 *
 * <p>Asserting after every step rather than only at the end is deliberate: a reconciliation
 * failure then names the operation that broke it instead of the whole scenario.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TallyAccessService.class, TallyLedgerService.class, TallyExpenseService.class,
         TallyBalanceService.class, TallyMoneyFlowTest.CacheStubConfig.class, TallyMapperImpl.class})
@DisplayName("db-tally money flow")
class TallyMoneyFlowTest {

    @TestConfiguration
    static class CacheStubConfig {
        @Bean
        CacheManager cacheManager() {
            return new NoOpCacheManager();
        }
    }

    private static final Long APPA_USER = 1L;
    private static final Long AMMA_USER = 2L;
    private static final Long OUTSIDER  = 99L;

    @Autowired private EntityManager em;
    @Autowired private TallyExpenseService expenseService;
    @Autowired private TallyBalanceService balanceService;
    @Autowired private TallyLedgerService ledgerService;
    @Autowired private TallySettlementRepository settlements;

    private String groupId;
    private String appa;
    private String amma;
    private String kid1;
    private String kid2;

    /**
     * Builds the group, then hands out the four roles <b>in ascending member-id order</b>.
     *
     * <p>Not fussiness. When a total will not divide evenly the leftover paise go to whoever
     * sorts first by member id — that tie-break is what makes the allocator reproducible, and
     * it is the reason voiding an expense can re-derive the same numbers it originally wrote.
     * But ids here are randomly generated UUIDs, so <em>which</em> person that is changes on
     * every run. A test that asserts "Appa ends up with 33.33" without pinning the ordering is
     * therefore a coin flip: it passed on the first run of this suite and failed on the second,
     * with no code changed in between.
     *
     * <p>Sorting the ids and assigning the people to them afterwards makes the scenario fully
     * determined, which is what lets the assertions below name exact rupee amounts instead of
     * retreating to "something that adds up".
     */
    @BeforeEach
    void setUpFamilyGroup() {
        TallyGroupEntity g = new TallyGroupEntity();
        g.setName("Home");
        g.setCreatedByUserId(APPA_USER);
        em.persist(g);
        groupId = g.getId();

        List<TallyGroupMemberEntity> roster = new java.util.ArrayList<>();
        for (int i = 0; i < 4; i++) {
            TallyGroupMemberEntity m = new TallyGroupMemberEntity();
            m.setGroupId(groupId);
            m.setDisplayName("placeholder " + i);
            em.persist(m);
            roster.add(m);
        }
        em.flush();
        roster.sort(java.util.Comparator.comparing(TallyGroupMemberEntity::getId));

        appa = name(roster.get(0), "Appa", APPA_USER, TallyMemberRole.OWNER);
        amma = name(roster.get(1), "Amma", AMMA_USER, TallyMemberRole.MEMBER);
        kid1 = name(roster.get(2), "Kid 1", null, TallyMemberRole.MEMBER);   // ghost
        kid2 = name(roster.get(3), "Kid 2", null, TallyMemberRole.MEMBER);   // ghost

        // Both children's liability rolls up to their parent. This is the thing Splitwise
        // cannot express, and the reason every share carries who-owes separately from who-ate.
        roster.get(2).setPaidForByMemberId(appa);
        roster.get(3).setPaidForByMemberId(appa);
        em.flush();
    }

    private static String name(TallyGroupMemberEntity m, String displayName, Long userId, TallyMemberRole role) {
        m.setDisplayName(displayName);
        m.setUserId(userId);
        m.setRole(role);
        return m.getId();
    }

    /* ============================== the full scenario ============================== */

    @Test
    @DisplayName("a family's month of expenses reconciles at every step and closes at zero")
    void fullScenario() {
        // 1. EQUAL, one payer, one delegated child.
        //    100 across three is the case that breaks naive rounding: 33.34 / 33.33 / 33.33.
        expenseService.create(APPA_USER, groupId, request("Groceries", "100.00", TallyMethod.EQUAL,
                List.of(payer(appa, "100.00")),
                List.of(part(appa), part(amma), part(kid1))));
        assertSound();
        assertThat(balances()).containsOnly(
                Map.entry(appa, bd("33.33")), Map.entry(amma, bd("-33.33")));

        // 2. PERCENT, paid by the other parent.
        String internet = expenseService.create(AMMA_USER, groupId, request("Internet", "1000.00",
                TallyMethod.PERCENT,
                List.of(payer(amma, "1000.00")),
                List.of(percent(appa, "50"), percent(amma, "50")))).id();
        assertSound();

        // 3. SHARES, two payers -- where the paise are rounded twice.
        expenseService.create(APPA_USER, groupId, request("Trip", "300.00", TallyMethod.SHARES,
                List.of(payer(appa, "200.00"), payer(amma, "100.00")),
                List.of(weight(appa, "2"), weight(amma, "1"), weight(kid2, "1"))));
        assertSound();

        // 4. EXACT, paid by a ghost -- somebody with no account can still front the money.
        expenseService.create(APPA_USER, groupId, request("Dinner", "50.00", TallyMethod.EXACT,
                List.of(payer(kid1, "50.00")),
                List.of(exact(appa, "20.00"), exact(amma, "30.00"))));
        assertSound();

        // 5. Void the largest expense. The reversal has to unwind it exactly.
        expenseService.voidExpense(AMMA_USER, internet);
        assertSound();

        // 6. Settle. Recording a payment is an ordinary write, not a rewrite of the ledger.
        settle(amma, appa, "33.33");
        assertSound();

        assertThat(balances()).containsOnly(
                Map.entry(appa, bd("-45.00")),
                Map.entry(amma, bd("-5.00")),
                Map.entry(kid1, bd("50.00")));
        // kid2 ate on the trip but owes nothing: their liability sits with their parent.
        assertThat(balances()).doesNotContainKey(kid2);
    }

    /* ============================== delegation ============================== */

    @Test
    @DisplayName("a delegated child's share lands on the parent, not the child")
    void delegationMovesLiabilityNotConsumption() {
        expenseService.create(APPA_USER, groupId, request("School lunch", "90.00", TallyMethod.EQUAL,
                List.of(payer(amma, "90.00")),
                List.of(part(kid1), part(kid2), part(appa))));
        assertSound();

        // Consumption is still recorded against the children -- that is the "where did the
        // money go" report, and it is a different question from who pays.
        assertThat(consumed()).containsOnly(
                Map.entry(kid1, bd("30.00")), Map.entry(kid2, bd("30.00")), Map.entry(appa, bd("30.00")));
        assertThat(balances()).containsOnly(
                Map.entry(appa, bd("-90.00")), Map.entry(amma, bd("90.00")));
    }

    @Test
    @DisplayName("changing a standing delegation never rewrites an expense already recorded")
    void delegationIsSnapshotted() {
        expenseService.create(APPA_USER, groupId, request("Before", "60.00", TallyMethod.EQUAL,
                List.of(payer(amma, "60.00")),
                List.of(part(kid1), part(kid2))));

        // The children start paying their own way from here on.
        em.find(TallyGroupMemberEntity.class, kid1).setPaidForByMemberId(null);
        em.find(TallyGroupMemberEntity.class, kid2).setPaidForByMemberId(null);
        em.flush();

        expenseService.create(APPA_USER, groupId, request("After", "60.00", TallyMethod.EQUAL,
                List.of(payer(amma, "60.00")),
                List.of(part(kid1), part(kid2))));
        assertSound();

        // The first expense still sits with the parent; only the second moved.
        assertThat(balances()).containsOnly(
                Map.entry(appa, bd("-60.00")),
                Map.entry(kid1, bd("-30.00")),
                Map.entry(kid2, bd("-30.00")),
                Map.entry(amma, bd("120.00")));
    }

    @Test
    @DisplayName("a per-expense override beats the standing delegation")
    void overrideBeatsDefault() {
        // kid1 delegates to appa by default, but pays for this one themselves.
        expenseService.create(APPA_USER, groupId, request("Kid's own book", "40.00", TallyMethod.EQUAL,
                List.of(payer(amma, "40.00")),
                List.of(owedBy(kid1, kid1), part(kid2))));
        assertSound();

        assertThat(balances()).containsOnly(
                Map.entry(kid1, bd("-20.00")),
                Map.entry(appa, bd("-20.00")),   // kid2's half, by standing delegation
                Map.entry(amma, bd("40.00")));
    }

    /* ============================== rounding ============================== */

    @Test
    @DisplayName("an expense that cannot divide evenly still closes to zero")
    void awkwardDivisionClosesExactly() {
        // 0.01 across four people: three get nothing, one gets the paisa. The allocator must
        // not invent 0.0025 anywhere, and the group must still balance.
        expenseService.create(APPA_USER, groupId, request("Sweet", "0.01", TallyMethod.EQUAL,
                List.of(payer(appa, "0.01")),
                List.of(part(appa), part(amma), part(kid1), part(kid2))));
        assertSound();

        assertThat(balances().values().stream().reduce(BigDecimal.ZERO, BigDecimal::add))
                .isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("a hundred awkward expenses do not drift")
    void repeatedRoundingDoesNotAccumulate() {
        // The failure mode this module exists to avoid: each expense looks right, and after a
        // few hundred of them the group can no longer settle because the arithmetic drifted.
        for (int i = 0; i < 100; i++) {
            expenseService.create(APPA_USER, groupId, request("Chai " + i, "10.00", TallyMethod.EQUAL,
                    List.of(payer(appa, "10.00")),
                    List.of(part(appa), part(amma), part(kid1))));
        }
        assertSound();

        // 10.00 across three is 3.34 / 3.33 / 3.33, and the extra paisa lands on the same
        // member every single time because the tie breaks on member id. So amma owes exactly
        // 100 x 3.33 -- a round 333.00, with no accumulated remainder anywhere.
        //
        // Had the allocator rounded each share independently, the totals here would be off by
        // up to a rupee and, worse, off by a DIFFERENT amount depending on insertion order.
        assertThat(balances()).containsOnly(
                Map.entry(appa, bd("333.00")),
                Map.entry(amma, bd("-333.00")));
    }

    /* ============================== settle-up ============================== */

    @Test
    @DisplayName("the settle-up plan clears the group and never exceeds n-1 transfers")
    void settleUpPlanClearsEverything() {
        expenseService.create(APPA_USER, groupId, request("Big shop", "100.00", TallyMethod.EQUAL,
                List.of(payer(appa, "100.00")),
                List.of(owedBy(appa, appa), owedBy(amma, amma), owedBy(kid1, kid1), owedBy(kid2, kid2))));

        List<SettleUpTransferDto> plan = balanceService.settleUpPlan(groupId);
        assertThat(plan).hasSizeLessThanOrEqualTo(3);   // n - 1 for four members

        plan.forEach(t -> settle(t.fromMemberId(), t.toMemberId(), t.amount().toPlainString()));
        assertSound();

        assertThat(balances()).as("recording the suggested plan squares the group").isEmpty();
        assertThat(balanceService.settleUpPlan(groupId)).isEmpty();
    }

    @Test
    @DisplayName("settling up is advice, not a mutation")
    void settleUpWritesNothing() {
        expenseService.create(APPA_USER, groupId, request("Shop", "100.00", TallyMethod.EQUAL,
                List.of(payer(appa, "100.00")),
                List.of(owedBy(appa, appa), owedBy(amma, amma))));
        Map<String, BigDecimal> before = balances();

        balanceService.settleUpPlan(groupId);
        balanceService.settleUpPlan(groupId);

        assertThat(balances()).isEqualTo(before);
    }

    /* ============================== refusals ============================== */

    @Test
    @DisplayName("an EXACT split that does not add up is refused before anything is written")
    void exactSplitMustAddUp() {
        assertThatThrownBy(() -> expenseService.create(APPA_USER, groupId,
                request("Wrong", "100.00", TallyMethod.EXACT,
                        List.of(payer(appa, "100.00")),
                        List.of(exact(appa, "40.00"), exact(amma, "40.00")))))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("80.00");

        assertThat(balances()).as("nothing was half-written").isEmpty();
    }

    @Test
    @DisplayName("payers that do not add up to the total are refused")
    void payersMustAddUp() {
        assertThatThrownBy(() -> expenseService.create(APPA_USER, groupId,
                request("Wrong", "100.00", TallyMethod.EQUAL,
                        List.of(payer(appa, "60.00")),
                        List.of(part(appa), part(amma)))))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("payments");
    }

    @Test
    @DisplayName("percentages must add up to 100")
    void percentagesMustAddUp() {
        assertThatThrownBy(() -> expenseService.create(APPA_USER, groupId,
                request("Wrong", "100.00", TallyMethod.PERCENT,
                        List.of(payer(appa, "100.00")),
                        List.of(percent(appa, "40"), percent(amma, "40")))))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("100");
    }

    @Test
    @DisplayName("an expense cannot name somebody from another group")
    void participantsMustBeMembers() {
        TallyGroupEntity other = new TallyGroupEntity();
        other.setName("Elsewhere");
        other.setCreatedByUserId(OUTSIDER);
        em.persist(other);
        TallyGroupMemberEntity stranger = new TallyGroupMemberEntity();
        stranger.setGroupId(other.getId());
        stranger.setDisplayName("Stranger");
        em.persist(stranger);
        em.flush();

        // No foreign keys exist, so nothing below the service layer would stop this.
        assertThatThrownBy(() -> expenseService.create(APPA_USER, groupId,
                request("Leak", "10.00", TallyMethod.EQUAL,
                        List.of(payer(appa, "10.00")),
                        List.of(part(appa), part(stranger.getId())))))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("Not an active member");
    }

    @Test
    @DisplayName("a non-member gets 404 on read and on write alike")
    void outsidersSeeNothing() {
        assertThatThrownBy(() -> expenseService.create(OUTSIDER, groupId,
                request("Sneaky", "10.00", TallyMethod.EQUAL,
                        List.of(payer(appa, "10.00")), List.of(part(appa)))))
                .isInstanceOf(DbWorldException.class)
                .satisfies(e -> assertThat(((DbWorldException) e).getHttpStatus().value())
                        .as("403 would confirm the group exists")
                        .isEqualTo(404));
    }

    @Test
    @DisplayName("the same idempotency key returns the original rather than a second expense")
    void idempotentRetry() {
        CreateExpenseRequest req = new CreateExpenseRequest("Groceries", bd("99.00"), TallyMethod.EQUAL,
                null, LocalDate.of(2026, 9, 1), null, "retry-token",
                List.of(payer(appa, "99.00")), List.of(part(appa), part(amma)));

        String first = expenseService.create(APPA_USER, groupId, req).id();
        String second = expenseService.create(APPA_USER, groupId, req).id();

        assertThat(second).isEqualTo(first);
        assertSound();
        assertThat(balances()).containsOnly(
                Map.entry(appa, bd("49.50")), Map.entry(amma, bd("-49.50")));
    }

    @Test
    @DisplayName("voiding twice is refused rather than silently doubling the reversal")
    void doubleVoidRefused() {
        String id = expenseService.create(APPA_USER, groupId, request("Once", "30.00", TallyMethod.EQUAL,
                List.of(payer(appa, "30.00")),
                List.of(part(appa), part(amma)))).id();

        expenseService.voidExpense(APPA_USER, id);
        assertThatThrownBy(() -> expenseService.voidExpense(APPA_USER, id))
                .isInstanceOf(DbWorldException.class);
        assertSound();
        assertThat(balances()).isEmpty();
    }

    @Test
    @DisplayName("voiding someone else's expense needs the owner role")
    void voidingSomebodyElsesNeedsOwner() {
        String mine = expenseService.create(AMMA_USER, groupId, request("Amma's", "20.00", TallyMethod.EQUAL,
                List.of(payer(amma, "20.00")), List.of(part(amma)))).id();

        // Appa is the OWNER, so he may.
        assertThat(expenseService.voidExpense(APPA_USER, mine).status())
                .isEqualTo(TallyExpenseStatus.VOIDED);

        String appas = expenseService.create(APPA_USER, groupId, request("Appa's", "20.00", TallyMethod.EQUAL,
                List.of(payer(appa, "20.00")), List.of(part(appa)))).id();

        assertThatThrownBy(() -> expenseService.voidExpense(AMMA_USER, appas))
                .isInstanceOf(DbWorldException.class)
                .satisfies(e -> assertThat(((DbWorldException) e).getHttpStatus().value())
                        .as("a proven member is not owed a 404 here")
                        .isEqualTo(403));
    }

    @Test
    @DisplayName("an archived group is closed for writes")
    void archivedGroupRefusesWrites() {
        em.find(TallyGroupEntity.class, groupId).setArchivedAt(Instant.now());
        em.flush();

        assertThatThrownBy(() -> expenseService.create(APPA_USER, groupId,
                request("Too late", "10.00", TallyMethod.EQUAL,
                        List.of(payer(appa, "10.00")), List.of(part(appa)))))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("archived");
    }

    /* ============================== correction ============================== */

    @Test
    @DisplayName("correcting an expense reverses the original and posts the new total")
    void replacePostsAReversalAndARepost() {
        String id = expenseService.create(APPA_USER, groupId, request("Typo", "1000.00", TallyMethod.EQUAL,
                List.of(payer(appa, "1000.00")),
                List.of(part(appa), part(amma)))).id();

        expenseService.replace(APPA_USER, id, request("Corrected", "100.00", TallyMethod.EQUAL,
                List.of(payer(appa, "100.00")),
                List.of(part(appa), part(amma))));
        assertSound();

        assertThat(balances()).containsOnly(
                Map.entry(appa, bd("50.00")), Map.entry(amma, bd("-50.00")));
        assertThat(em.find(TallyExpenseEntity.class, id).getStatus())
                .as("the original is kept, not deleted")
                .isEqualTo(TallyExpenseStatus.VOIDED);
    }

    /* ============================== invariants ============================== */

    /**
     * The two assertions that make this suite worth running. See the class javadoc.
     */
    private void assertSound() {
        em.flush();
        em.clear();

        assertThat(balances())
                .as("the ledger projection must agree with shares, payers and settlements")
                .isEqualTo(normalise(balanceService.balancesFromSourceOfTruth(groupId)));

        assertThat(balances().values().stream().reduce(BigDecimal.ZERO, BigDecimal::add))
                .as("a closed system cannot have a nonzero total")
                .isEqualByComparingTo("0");
    }

    /* ============================== fixtures ============================== */

    private Map<String, BigDecimal> balances() {
        return normalise(balanceService.balances(groupId));
    }

    private Map<String, BigDecimal> consumed() {
        return normalise(new java.util.TreeMap<>(
                em.createQuery("""
                        select s.beneficiaryMemberId, sum(s.amount)
                          from TallyExpenseShareEntity s
                          join TallyExpenseEntity e on e.id = s.expenseId
                         where e.groupId = :g and e.status = :st
                         group by s.beneficiaryMemberId
                        """, Object[].class)
                        .setParameter("g", groupId)
                        .setParameter("st", TallyExpenseStatus.ACTIVE)
                        .getResultStream()
                        .collect(java.util.stream.Collectors.toMap(
                                r -> (String) r[0], r -> (BigDecimal) r[1]))));
    }

    /** Scale differs between an aggregate and a difference; compare values, not representations. */
    private static Map<String, BigDecimal> normalise(Map<String, BigDecimal> in) {
        return new java.util.TreeMap<>(in.entrySet().stream()
                .collect(java.util.stream.Collectors.toMap(Map.Entry::getKey,
                        e -> e.getValue().setScale(2, java.math.RoundingMode.UNNECESSARY))));
    }

    private void settle(String from, String to, String amount) {
        TallySettlementEntity s = new TallySettlementEntity();
        s.setGroupId(groupId);
        s.setFromMemberId(from);
        s.setToMemberId(to);
        s.setAmount(bd(amount));
        s.setSettledAt(Instant.now());
        s.setRecordedByUserId(APPA_USER);
        settlements.save(s);
        ledgerService.postSettlement(s);
    }

    private static CreateExpenseRequest request(String description, String total, TallyMethod method,
                                                List<PayerInput> payers, List<ParticipantInput> participants) {
        return new CreateExpenseRequest(description, bd(total), method, null,
                LocalDate.of(2026, 9, 1), null, null, payers, participants);
    }

    private static PayerInput payer(String memberId, String amount) {
        return new PayerInput(memberId, bd(amount));
    }

    /** A participant on the group's standing rules. */
    private static ParticipantInput part(String memberId) {
        return new ParticipantInput(memberId, null, null, null, null);
    }

    private static ParticipantInput owedBy(String memberId, String owedByMemberId) {
        return new ParticipantInput(memberId, null, null, null, owedByMemberId);
    }

    private static ParticipantInput exact(String memberId, String amount) {
        return new ParticipantInput(memberId, bd(amount), null, null, null);
    }

    private static ParticipantInput percent(String memberId, String percent) {
        return new ParticipantInput(memberId, null, bd(percent), null, null);
    }

    private static ParticipantInput weight(String memberId, String weight) {
        return new ParticipantInput(memberId, null, null, bd(weight), null);
    }

    private static BigDecimal bd(String v) {
        return new BigDecimal(v);
    }
}
