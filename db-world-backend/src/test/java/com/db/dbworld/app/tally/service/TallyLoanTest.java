package com.db.dbworld.app.tally.service;

import com.db.dbworld.app.tally.dto.CreateExpenseRequest;
import com.db.dbworld.app.tally.dto.CreateLoanRequest;
import com.db.dbworld.app.tally.dto.RecordSettlementRequest;
import com.db.dbworld.app.tally.dto.TallyLoanDirection;
import com.db.dbworld.app.tally.dto.TallyLoanDto;
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
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Lending, borrowing, and getting half of it back.
 *
 * <p>The assertions that matter are the ones about PROGRESS. A ledger that only nets balances
 * cannot tell "lent 1,000, got 500 back" from "lent 500" — both read as 500 owed — so every test
 * here that checks an outstanding figure also checks the principal beside it. That pair is the
 * whole feature; the balance was already correct before it existed.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TallyAccessService.class, TallyLedgerService.class, TallyExpenseService.class,
         TallyBalanceService.class, TallyActivityService.class, TallySettlementService.class,
         TallyLoanTest.LoanTestConfig.class, TallyMapperImpl.class})
@DisplayName("db-tally loans")
class TallyLoanTest {

    /** Fixed so "overdue" is a decision about the data, not about the day the suite runs. */
    private static final Clock FIXED_CLOCK =
            Clock.fixed(Instant.parse("2026-09-20T06:00:00Z"), ZoneId.of("UTC"));
    private static final LocalDate TODAY = LocalDate.of(2026, 9, 20);

    private static final Long ME_USER   = 1L;
    private static final Long THEM_USER = 2L;

    @TestConfiguration
    static class LoanTestConfig {
        @Bean CacheManager cacheManager() { return new NoOpCacheManager(); }

        @Bean TallyLoanService tallyLoanService(TallyAccessService access,
                                                TallyExpenseService expenseService,
                                                TallyExpenseRepository expenses,
                                                TallyExpensePayerRepository payers,
                                                TallyExpenseShareRepository shares,
                                                TallyGroupMemberRepository members,
                                                TallyGroupRepository groups,
                                                TallySettlementRepository settlements) {
            return new TallyLoanService(access, expenseService, expenses, payers, shares, members,
                    groups, settlements, FIXED_CLOCK);
        }
    }

    @Autowired private EntityManager em;
    @Autowired private TallyLoanService loans;
    @Autowired private TallySettlementService settlementService;
    @Autowired private TallyBalanceService balances;
    @Autowired private TallyExpenseService expenseService;
    @Autowired private TallyExpenseShareRepository shares;

    private String groupId;
    private String me;
    private String them;

    @BeforeEach
    void setUpDirectLedger() {
        TallyGroupEntity g = new TallyGroupEntity();
        g.setName("Riya");
        g.setKind(TallyGroupKind.DIRECT);
        g.setCreatedByUserId(ME_USER);
        em.persist(g);
        groupId = g.getId();

        me   = member("Me", ME_USER, TallyMemberRole.OWNER);
        them = member("Riya", THEM_USER, TallyMemberRole.MEMBER);
        em.flush();
    }

    private String member(String displayName, Long userId, TallyMemberRole role) {
        TallyGroupMemberEntity m = new TallyGroupMemberEntity();
        m.setGroupId(groupId);
        m.setDisplayName(displayName);
        m.setUserId(userId);
        m.setRole(role);
        em.persist(m);
        return m.getId();
    }

    /* ============================== the headline ============================== */

    @Test
    @DisplayName("lend 1,000, get 500 back: principal, repaid and outstanding are all recoverable")
    void halfRepaidLoanKeepsAllThreeNumbers() {
        TallyLoanDto created = loans.create(ME_USER, groupId, lend("1000.00", null));
        assertThat(created.principal()).isEqualByComparingTo("1000.00");
        assertThat(created.repaid()).isEqualByComparingTo("0.00");
        assertThat(created.outstanding()).isEqualByComparingTo("1000.00");
        assertThat(created.settled()).isFalse();

        // She owes me the lot.
        assertThat(balances.netOf(groupId, them)).isEqualByComparingTo("-1000.00");
        assertThat(balances.netOf(groupId, me)).isEqualByComparingTo("1000.00");

        repay(created.id(), "500.00");
        em.flush();
        em.clear();

        TallyLoanDto half = only(loans.listMine(ME_USER));
        assertThat(half.principal()).isEqualByComparingTo("1000.00");
        assertThat(half.repaid()).isEqualByComparingTo("500.00");
        assertThat(half.outstanding()).isEqualByComparingTo("500.00");
        assertThat(half.settled()).isFalse();

        // And the balance agrees, which is the point of reusing the settlement path.
        assertThat(balances.netOf(groupId, them)).isEqualByComparingTo("-500.00");
    }

    /**
     * The distinction a netted balance cannot make. Both ledgers below read "500 owed"; only the
     * principal tells them apart.
     */
    @Test
    @DisplayName("a half-repaid 1,000 is distinguishable from an untouched 500")
    void progressDistinguishesTwoLoansWithTheSameBalance() {
        TallyLoanDto big = loans.create(ME_USER, groupId, lend("1000.00", null));
        repay(big.id(), "500.00");
        em.flush();
        em.clear();

        TallyLoanDto halfRepaid = only(loans.listMine(ME_USER));
        assertThat(halfRepaid.outstanding()).isEqualByComparingTo("500.00");
        assertThat(halfRepaid.principal()).isEqualByComparingTo("1000.00");
        assertThat(halfRepaid.repaid()).isEqualByComparingTo("500.00");
    }

    @Test
    @DisplayName("repaying the rest settles the loan and clears the balance")
    void fullRepaymentSettles() {
        TallyLoanDto loan = loans.create(ME_USER, groupId, lend("1000.00", null));
        repay(loan.id(), "500.00");
        repay(loan.id(), "500.00");
        em.flush();
        em.clear();

        TallyLoanDto done = only(loans.listMine(ME_USER));
        assertThat(done.repaid()).isEqualByComparingTo("1000.00");
        assertThat(done.outstanding()).isEqualByComparingTo("0.00");
        assertThat(done.settled()).isTrue();
        assertThat(balances.netOf(groupId, them)).isEqualByComparingTo("0.00");
    }

    /** Rounding up when paying back is ordinary, and must not read as a debt the other way. */
    @Test
    @DisplayName("an overpayment reads as settled rather than as a negative debt")
    void overpaymentFloorsAtZero() {
        TallyLoanDto loan = loans.create(ME_USER, groupId, lend("490.00", null));
        repay(loan.id(), "500.00");
        em.flush();
        em.clear();

        TallyLoanDto done = only(loans.listMine(ME_USER));
        assertThat(done.repaid()).isEqualByComparingTo("500.00");   // reported honestly
        assertThat(done.outstanding()).isEqualByComparingTo("0.00"); // but floored
        assertThat(done.settled()).isTrue();
    }

    /* ============================== a loan is not spending ============================== */

    @Test
    @DisplayName("a loan is excluded from spending, while a real expense in the same ledger is not")
    void loansDoNotCountAsSpending() {
        loans.create(ME_USER, groupId, lend("1000.00", null));
        expenseService.create(ME_USER, groupId, dinnerSplitEqually("300.00"));
        em.flush();

        // The report's own query, which is what the spending figures are built from.
        BigDecimal theirSpending = shares.sumConsumed(
                List.of(groupId), List.of(them), TODAY.minusDays(30), TODAY);

        // 150 of the dinner, and none of the 1,000 she borrowed.
        assertThat(theirSpending).isEqualByComparingTo("150.00");
    }

    /* ============================== direction ============================== */

    @Test
    @DisplayName("the same loan is LENT to one side and BORROWED to the other")
    void directionIsRelativeToWhoIsAsking() {
        loans.create(ME_USER, groupId, lend("1000.00", null));
        em.flush();
        em.clear();

        assertThat(only(loans.listMine(ME_USER)).direction()).isEqualTo(TallyLoanDirection.LENT);
        assertThat(only(loans.listMine(THEM_USER)).direction()).isEqualTo(TallyLoanDirection.BORROWED);
    }

    @Test
    @DisplayName("borrowing puts the debt on me")
    void borrowingInvertsTheLedger() {
        TallyLoanDto borrowed = loans.create(ME_USER, groupId,
                new CreateLoanRequest(them, TallyLoanDirection.BORROWED, new BigDecimal("750.00"),
                        TODAY, null, "rent", "b1"));

        assertThat(borrowed.direction()).isEqualTo(TallyLoanDirection.BORROWED);
        assertThat(balances.netOf(groupId, me)).isEqualByComparingTo("-750.00");
    }

    /* ============================== due dates ============================== */

    @Test
    @DisplayName("a past due date with something outstanding is overdue; a settled one never is")
    void overdueNeedsBothAPastDateAndABalance() {
        TallyLoanDto late = loans.create(ME_USER, groupId, lend("100.00", TODAY.minusDays(1)));
        em.flush();
        em.clear();
        assertThat(only(loans.listMine(ME_USER)).overdue()).isTrue();

        repay(late.id(), "100.00");
        em.flush();
        em.clear();
        assertThat(only(loans.listMine(ME_USER)).overdue()).isFalse();
    }

    @Test
    @DisplayName("a due date today is not yet overdue")
    void dueTodayIsNotOverdue() {
        loans.create(ME_USER, groupId, lend("100.00", TODAY));
        em.flush();
        em.clear();
        assertThat(only(loans.listMine(ME_USER)).overdue()).isFalse();
    }

    /* ============================== refusals ============================== */

    @Test
    @DisplayName("a due date before the money moved is refused")
    void dueDateCannotPrecedeTheLoan() {
        assertThatThrownBy(() -> loans.create(ME_USER, groupId,
                new CreateLoanRequest(them, TallyLoanDirection.LENT, new BigDecimal("10.00"),
                        TODAY, TODAY.minusDays(2), null, "bad")))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("due date cannot be before");
    }

    @Test
    @DisplayName("you cannot lend to yourself")
    void selfLoanIsRefused() {
        assertThatThrownBy(() -> loans.create(ME_USER, groupId,
                new CreateLoanRequest(me, TallyLoanDirection.LENT, new BigDecimal("10.00"),
                        TODAY, null, null, "self")))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("two different people");
    }

    @Test
    @DisplayName("a repayment cannot be allocated to an ordinary expense")
    void repaymentRefusesANonLoan() {
        var dinner = expenseService.create(ME_USER, groupId, dinnerSplitEqually("300.00"));
        em.flush();

        assertThatThrownBy(() -> repay(dinner.id(), "10.00"))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("not a loan");
    }

    /* ============================== helpers ============================== */

    private CreateLoanRequest lend(String amount, LocalDate dueDate) {
        // Backdated to the due date when that is in the past: a loan cannot fall due before it
        // was handed over, and the service refuses the combination rather than flagging a loan
        // overdue on the day it was made.
        LocalDate lentOn = dueDate != null && dueDate.isBefore(TODAY) ? dueDate.minusDays(7) : TODAY;
        return new CreateLoanRequest(them, TallyLoanDirection.LENT, new BigDecimal(amount),
                lentOn, dueDate, null, "lend-" + amount + "-" + dueDate);
    }

    /**
     * Riya pays me back, naming the loan.
     *
     * <p>The key carries a counter, not just the amount. Two repayments of 500 against one loan
     * are two real payments, and a key derived from the amount makes them identical -- which the
     * idempotency guard then correctly treats as a retry and swallows.
     */
    private int repayments = 0;

    private void repay(String loanId, String amount) {
        settlementService.record(ME_USER, groupId, new RecordSettlementRequest(
                them, me, new BigDecimal(amount), "UPI", loanId, Instant.now(FIXED_CLOCK),
                "repay-" + loanId + "-" + (++repayments)));
    }

    private CreateExpenseRequest dinnerSplitEqually(String amount) {
        return new CreateExpenseRequest("Dinner", new BigDecimal(amount), TallyMethod.EQUAL,
                "food", TODAY, null, "dinner-" + amount,
                List.of(new CreateExpenseRequest.PayerInput(me, new BigDecimal(amount))),
                List.of(new CreateExpenseRequest.ParticipantInput(me, null, null, null, null),
                        new CreateExpenseRequest.ParticipantInput(them, null, null, null, null)));
    }

    private static TallyLoanDto only(List<TallyLoanDto> list) {
        assertThat(list).hasSize(1);
        return list.getFirst();
    }
}
