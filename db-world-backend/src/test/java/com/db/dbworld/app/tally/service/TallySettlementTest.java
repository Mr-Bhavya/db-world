package com.db.dbworld.app.tally.service;

import com.db.dbworld.app.tally.dto.*;
import com.db.dbworld.app.tally.entity.*;
import com.db.dbworld.app.tally.mapper.TallyMapperImpl;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.role.entity.RoleEntity;
import com.db.dbworld.core.role.enums.Role;
import com.db.dbworld.core.user.entity.UserEntity;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Paying people back.
 *
 * <p>The direction of a settlement's ledger entry is the thing worth testing hardest. A
 * settlement row says "A paid B", but the ledger edge it writes is "B owes A" — handing over
 * cash creates a claim against the recipient, and that claim is what cancels the debt. Getting
 * it backwards is silent: balances still move, just twice as far the wrong way, and the group
 * finds out when settling up makes the debt bigger.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TallyAccessService.class, TallyLedgerService.class, TallyExpenseService.class,
         TallyBalanceService.class, TallyGroupService.class, TallyMemberService.class,
         TallySettlementService.class, TallySettlementTest.CacheStubConfig.class,
         TallyMapperImpl.class})
@DisplayName("db-tally settlements")
class TallySettlementTest {

    @TestConfiguration
    static class CacheStubConfig {
        @Bean
        CacheManager cacheManager() {
            return new NoOpCacheManager();
        }
    }

    @Autowired private EntityManager em;
    @Autowired private TallyGroupService groupService;
    @Autowired private TallyMemberService memberService;
    @Autowired private TallyExpenseService expenseService;
    @Autowired private TallySettlementService settlementService;
    @Autowired private TallyBalanceService balanceService;

    private Long appaUser;
    private Long ammaUser;
    private Long outsider;
    private String groupId;
    private String appa;
    private String amma;

    @BeforeEach
    void setUp() {
        RoleEntity role = new RoleEntity();
        role.setName(Role.VIEWER);
        em.persist(role);

        appaUser = user(role, "Appa");
        ammaUser = user(role, "Amma");
        outsider = user(role, "Outsider");
        em.flush();

        var group = groupService.create(appaUser, new CreateGroupRequest("Home", null));
        groupId = group.id();
        appa = group.members().getFirst().id();
        amma = memberService.add(appaUser, groupId, new AddMemberRequest(ammaUser, null, null)).id();

        // Appa fronts 100 for the two of them, so Amma owes 50.
        expenseService.create(appaUser, groupId, new CreateExpenseRequest(
                "Groceries", bd("100.00"), TallyMethod.EQUAL, null, LocalDate.of(2026, 9, 1), null, null,
                List.of(new CreateExpenseRequest.PayerInput(appa, bd("100.00"))),
                List.of(participant(appa), participant(amma))));
    }

    /* ============================== recording ============================== */

    @Test
    @DisplayName("paying what you owe clears the debt rather than doubling it")
    void payingSettlesTheDebt() {
        assertThat(balance(amma)).isEqualByComparingTo("-50.00");

        settlementService.record(ammaUser, groupId, settle(amma, appa, "50.00", null));

        // If the ledger edge were written the same way round as the settlement row, Amma would
        // now be at -100.00 and Appa at +100.00 -- plausible-looking numbers, both wrong.
        assertThat(balanceService.balances(groupId))
                .as("the group is square")
                .isEmpty();
    }

    @Test
    @DisplayName("a partial payment leaves the remainder")
    void partialPayment() {
        settlementService.record(ammaUser, groupId, settle(amma, appa, "20.00", null));

        assertThat(balance(amma)).isEqualByComparingTo("-30.00");
        assertThat(balance(appa)).isEqualByComparingTo("30.00");
    }

    @Test
    @DisplayName("overpaying flips the balance rather than being refused")
    void overpaymentFlipsTheBalance() {
        // Deliberately allowed. People round up, and pay 500 against a 480 debt on purpose. The
        // ledger records what happened; refusing it would force a fiction.
        settlementService.record(ammaUser, groupId, settle(amma, appa, "80.00", null));

        assertThat(balance(amma)).isEqualByComparingTo("30.00");
        assertThat(balance(appa)).isEqualByComparingTo("-30.00");
    }

    @Test
    @DisplayName("a repeated idempotency key returns the original and moves nothing twice")
    void idempotentRetry() {
        // The reason this matters more here than anywhere else: settlement is one-sided, so a
        // duplicate does not merely add a row. It moves the balance by the full amount again.
        var first = settlementService.record(ammaUser, groupId, settle(amma, appa, "50.00", "tap-once"));
        var second = settlementService.record(ammaUser, groupId, settle(amma, appa, "50.00", "tap-once"));

        assertThat(second.id()).isEqualTo(first.id());
        assertThat(balanceService.balances(groupId)).isEmpty();
        assertThat(settlementService.list(appaUser, groupId)).hasSize(1);
    }

    @Test
    @DisplayName("the settled-at time is the caller's, not the clock's")
    void settledAtIsCallerSupplied() {
        // Money often moves before anybody records it.
        Instant lastWeek = Instant.parse("2026-09-07T10:15:30Z");
        var settlement = settlementService.record(ammaUser, groupId,
                new RecordSettlementRequest(amma, appa, bd("50.00"), "UPI", lastWeek, null));

        assertThat(settlement.settledAt()).isEqualTo(lastWeek);
        assertThat(settlement.method()).isEqualTo("UPI");
        assertThat(settlement.recordedByUserId()).isEqualTo(ammaUser);
    }

    /* ============================== reversing ============================== */

    @Test
    @DisplayName("reversing a payment puts the balance back exactly")
    void reversalRestoresTheBalance() {
        var settlement = settlementService.record(ammaUser, groupId, settle(amma, appa, "50.00", null));
        assertThat(balanceService.balances(groupId)).isEmpty();

        var reversed = settlementService.reverse(ammaUser, settlement.id());

        assertThat(reversed.status()).isEqualTo(TallySettlementStatus.REVERSED);
        assertThat(balance(amma)).isEqualByComparingTo("-50.00");
        assertThat(balance(appa)).isEqualByComparingTo("50.00");
    }

    @Test
    @DisplayName("a reversed payment is kept but no longer listed")
    void reversedPaymentsLeaveHistory() {
        // Not deleted: "recorded then taken back" is a different story from "never happened",
        // and only one of them is true.
        var settlement = settlementService.record(ammaUser, groupId, settle(amma, appa, "50.00", null));
        settlementService.reverse(ammaUser, settlement.id());

        assertThat(settlementService.list(appaUser, groupId)).isEmpty();
        assertThat(em.find(TallySettlementEntity.class, settlement.id())).isNotNull();
    }

    @Test
    @DisplayName("reversing twice is refused rather than silently paying again")
    void doubleReversalRefused() {
        var settlement = settlementService.record(ammaUser, groupId, settle(amma, appa, "50.00", null));
        settlementService.reverse(ammaUser, settlement.id());

        assertThatThrownBy(() -> settlementService.reverse(ammaUser, settlement.id()))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("already been reversed");

        assertThat(balance(amma)).isEqualByComparingTo("-50.00");
    }

    @Test
    @DisplayName("undoing somebody else's payment needs the owner role")
    void reversingSomebodyElsesNeedsOwner() {
        var ammas = settlementService.record(ammaUser, groupId, settle(amma, appa, "50.00", null));

        // Appa is the owner, so he may undo Amma's.
        assertThat(settlementService.reverse(appaUser, ammas.id()).status())
                .isEqualTo(TallySettlementStatus.REVERSED);

        var appas = settlementService.record(appaUser, groupId, settle(appa, amma, "10.00", null));
        assertThatThrownBy(() -> settlementService.reverse(ammaUser, appas.id()))
                .isInstanceOf(DbWorldException.class)
                .satisfies(e -> assertThat(((DbWorldException) e).getHttpStatus().value()).isEqualTo(403));
    }

    /* ============================== refusals ============================== */

    @Test
    @DisplayName("a payment needs two different people")
    void selfPaymentRefused() {
        assertThatThrownBy(() -> settlementService.record(appaUser, groupId, settle(appa, appa, "10.00", null)))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("two different people");
    }

    @Test
    @DisplayName("a payment cannot name somebody outside the group")
    void strangerRefused() {
        // No foreign keys exist on these columns, so this check is the only thing stopping a
        // settlement pointing into another group.
        var elsewhere = groupService.create(ammaUser, new CreateGroupRequest("Elsewhere", null));
        String stranger = elsewhere.members().getFirst().id();

        assertThatThrownBy(() -> settlementService.record(appaUser, groupId, settle(appa, stranger, "10.00", null)))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("not in this group");
    }

    @Test
    @DisplayName("somebody who has left cannot be paid")
    void departedMemberRefused() {
        // Removal already required their balance to be zero, so a payment naming them would be
        // settling a debt that does not exist -- and would push them off zero with nothing left
        // that could bring them back.
        String kid = memberService.add(appaUser, groupId, new AddMemberRequest(null, "Kid", null)).id();
        memberService.remove(appaUser, groupId, kid);

        assertThatThrownBy(() -> settlementService.record(appaUser, groupId, settle(appa, kid, "10.00", null)))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("not in this group");
    }

    @Test
    @DisplayName("an archived group takes no more payments")
    void archivedGroupRefusesPayments() {
        groupService.update(appaUser, groupId, new UpdateGroupRequest(null, null, true, true));

        assertThatThrownBy(() -> settlementService.record(appaUser, groupId, settle(amma, appa, "50.00", null)))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("archived");
    }

    @Test
    @DisplayName("a non-member gets 404 on reading and on recording alike")
    void outsidersSeeNothing() {
        assertThatThrownBy(() -> settlementService.list(outsider, groupId))
                .isInstanceOf(DbWorldException.class)
                .satisfies(e -> assertThat(((DbWorldException) e).getHttpStatus().value()).isEqualTo(404));
        assertThatThrownBy(() -> settlementService.record(outsider, groupId, settle(amma, appa, "50.00", null)))
                .isInstanceOf(DbWorldException.class)
                .satisfies(e -> assertThat(((DbWorldException) e).getHttpStatus().value()).isEqualTo(404));
        assertThatThrownBy(() -> settlementService.settleUpPlan(outsider, groupId))
                .isInstanceOf(DbWorldException.class)
                .satisfies(e -> assertThat(((DbWorldException) e).getHttpStatus().value()).isEqualTo(404));
    }

    /* ============================== settle-up ============================== */

    @Test
    @DisplayName("the settle-up plan names both people and clears the group when followed")
    void settleUpPlanCarriesNamesAndWorks() {
        List<SettleUpTransferDto> plan = settlementService.settleUpPlan(appaUser, groupId);

        assertThat(plan).singleElement().satisfies(t -> {
            assertThat(t.fromMemberId()).isEqualTo(amma);
            assertThat(t.fromMemberName()).isEqualTo("Amma");
            assertThat(t.toMemberId()).isEqualTo(appa);
            assertThat(t.toMemberName()).isEqualTo("Appa");
            assertThat(t.amount()).isEqualByComparingTo("50.00");
        });

        plan.forEach(t -> settlementService.record(ammaUser, groupId,
                settle(t.fromMemberId(), t.toMemberId(), t.amount().toPlainString(), null)));

        assertThat(balanceService.balances(groupId)).isEmpty();
        assertThat(settlementService.settleUpPlan(appaUser, groupId)).isEmpty();
    }

    @Test
    @DisplayName("asking for the plan changes nothing")
    void settleUpIsAdviceOnly() {
        var before = balanceService.balances(groupId);

        settlementService.settleUpPlan(appaUser, groupId);
        settlementService.settleUpPlan(appaUser, groupId);

        assertThat(balanceService.balances(groupId)).isEqualTo(before);
        assertThat(settlementService.list(appaUser, groupId)).isEmpty();
    }

    /* ============================== fixtures ============================== */

    private Long user(RoleEntity role, String firstName) {
        UserEntity u = new UserEntity();
        u.setFirstName(firstName);
        u.setEmail(firstName.toLowerCase() + "@example.test");
        u.setRole(role);
        em.persist(u);
        return u.getUserId();
    }

    private static CreateExpenseRequest.ParticipantInput participant(String memberId) {
        return new CreateExpenseRequest.ParticipantInput(memberId, null, null, null, memberId);
    }

    private static RecordSettlementRequest settle(String from, String to, String amount, String key) {
        return new RecordSettlementRequest(from, to, bd(amount), null, null, key);
    }

    private BigDecimal balance(String memberId) {
        return balanceService.netOf(groupId, memberId);
    }

    private static BigDecimal bd(String v) {
        return new BigDecimal(v);
    }
}
