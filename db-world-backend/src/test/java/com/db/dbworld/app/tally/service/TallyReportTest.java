package com.db.dbworld.app.tally.service;

import com.db.dbworld.app.tally.dto.AddMemberRequest;
import com.db.dbworld.app.tally.dto.CreateDirectRequest;
import com.db.dbworld.app.tally.dto.CreateExpenseRequest;
import com.db.dbworld.app.tally.dto.CreateGroupRequest;
import com.db.dbworld.app.tally.dto.TallyReportBucketDto;
import com.db.dbworld.app.tally.dto.TallyReportCategoryDto;
import com.db.dbworld.app.tally.dto.TallyReportLedgerDto;
import com.db.dbworld.app.tally.dto.TallyGroupReportMemberDto;
import com.db.dbworld.app.tally.dto.TallyReportPeriod;
import com.db.dbworld.app.tally.dto.TallySpendingReportDto;
import com.db.dbworld.app.tally.dto.UpdateGroupRequest;
import com.db.dbworld.app.tally.entity.TallyGroupKind;
import com.db.dbworld.app.tally.entity.TallyGroupMemberEntity;
import com.db.dbworld.app.tally.entity.TallyMemberStatus;
import com.db.dbworld.app.tally.entity.TallyMethod;
import com.db.dbworld.app.tally.dto.RecordSettlementRequest;
import com.db.dbworld.app.tally.mapper.TallyMapperImpl;
import com.db.dbworld.app.tally.repository.TallyExpensePayerRepository;
import com.db.dbworld.app.tally.repository.TallyExpenseRepository;
import com.db.dbworld.app.tally.repository.TallyExpenseShareRepository;
import com.db.dbworld.app.tally.repository.TallyGroupMemberRepository;
import com.db.dbworld.app.tally.repository.TallyGroupRepository;
import com.db.dbworld.app.tally.repository.TallySettlementRepository;
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
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The spending report: what one person consumed, across every ledger they are in.
 *
 * <p>Nearly every test here is guarding the same distinction from a different angle — that this
 * report counts what the caller <em>ate</em>, not what they <em>handed over</em>. Both numbers
 * are in the database, one column apart, and picking the wrong one produces a report that looks
 * entirely reasonable and is wrong for anybody who ever paid for a table.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TallyAccessService.class, TallyLedgerService.class, TallyExpenseService.class,
         TallyBalanceService.class, TallyGroupService.class, TallyMemberService.class,
         TallyActivityService.class, TallySettlementService.class,
         TallyReportTest.CacheStubConfig.class, TallyMapperImpl.class})
@DisplayName("db-tally spending report")
class TallyReportTest {

    @TestConfiguration
    static class CacheStubConfig {
        @Bean
        CacheManager cacheManager() {
            return new NoOpCacheManager();
        }
    }

    /** Midday IST on 15 September 2026, so "this month" is a half-finished September. */
    private static final Clock NOW =
            Clock.fixed(Instant.parse("2026-09-15T06:30:00Z"), ZoneId.of("Asia/Kolkata"));

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 15);

    @Autowired private EntityManager em;
    @Autowired private TallyGroupService groupService;
    @Autowired private TallyMemberService memberService;
    @Autowired private TallyExpenseService expenseService;
    @Autowired private TallySettlementService settlementService;
    @Autowired private TallyAccessService access;
    @Autowired private TallyGroupMemberRepository memberRepo;
    @Autowired private TallyGroupRepository groupRepo;
    @Autowired private TallyExpenseRepository expenseRepo;
    @Autowired private TallyExpenseShareRepository shareRepo;
    @Autowired private TallyExpensePayerRepository payerRepo;
    @Autowired private TallySettlementRepository settlementRepo;

    private TallyReportService reports;

    private Long appaUser;
    private Long ammaUser;
    private Long outsider;
    private String groupId;
    private String appa;
    private String amma;

    @BeforeEach
    void setUp() {
        // Built by hand rather than @Import-ed so the clock is fixed: half the report is a
        // function of "today", and a test that passes only until the 1st of the month is not a
        // test. The package-private constructor exists for exactly this.
        reports = reportsAt(NOW);

        RoleEntity role = new RoleEntity();
        role.setName(Role.VIEWER);
        em.persist(role);
        appaUser = user(role, "Appa");
        ammaUser = user(role, "Amma");
        outsider = user(role, "Outsider");
        em.flush();

        var group = groupService.create(appaUser, new CreateGroupRequest("Home", "Family", null));
        groupId = group.id();
        appa = group.myMemberId();
        amma = memberService.add(appaUser, groupId, new AddMemberRequest(ammaUser, null, null)).id();
    }

    /* ============================== consumed, not paid ============================== */

    @Test
    @DisplayName("paying the whole bill is not the same as consuming it")
    void consumedNotPaid() {
        // Appa puts ₹900 on his card for a dinner the two of them split. He is out ₹900 tonight
        // and Amma owes him ₹450 -- but he ate ₹450 of dinner, and that is what a spending
        // report is for. Reading the payer rows instead would double this.
        spend("Dinner", "900.00", TODAY, "Food", appa, amma);

        assertThat(report(TallyReportPeriod.MONTH).total()).isEqualByComparingTo("450.00");
    }

    @Test
    @DisplayName("a share somebody else covers for you is still yours")
    void delegationFollowsTheBeneficiary() {
        // Amma's share is owed by Appa -- he is paying for her. Two different people are
        // recorded on the one row: she consumed it, he is liable for it. The report follows the
        // beneficiary, so his figure does not swell with her dinner.
        var request = new CreateExpenseRequest("Dinner", bd("900.00"), TallyMethod.EQUAL, "Food",
                TODAY, null, null,
                List.of(new CreateExpenseRequest.PayerInput(appa, bd("900.00"))),
                List.of(new CreateExpenseRequest.ParticipantInput(appa, null, null, null, null),
                        new CreateExpenseRequest.ParticipantInput(amma, null, null, null, appa)));
        expenseService.create(appaUser, groupId, request);

        assertThat(report(TallyReportPeriod.MONTH).total())
                .as("Appa is liable for ₹900 but ate ₹450")
                .isEqualByComparingTo("450.00");
        assertThat(reports.spending(ammaUser, TallyReportPeriod.MONTH, TODAY).total())
                .as("Amma pays nothing and still ate ₹450")
                .isEqualByComparingTo("450.00");
    }

    /* ============================== across every ledger ============================== */

    @Test
    @DisplayName("personal, one-to-one and group spending all land in one total")
    void everyLedgerAddsIn() {
        var personal = groupService.personalLedger(appaUser);
        spendIn(personal.id(), "Coffee", "100.00", TODAY, "Tea/Coffee",
                personal.myMemberId());

        var direct = groupService.createDirect(appaUser, new CreateDirectRequest(ammaUser, null));
        spendIn(direct.id(), "Taxi", "200.00", TODAY, "Travel",
                direct.myMemberId());

        spend("Dinner", "900.00", TODAY, "Food", appa, amma);   // his half is 450

        var report = report(TallyReportPeriod.MONTH);

        assertThat(report.total()).isEqualByComparingTo("750.00");
        assertThat(report.ledgers()).extracting(TallyReportLedgerDto::kind)
                .containsExactlyInAnyOrder(TallyGroupKind.PERSONAL, TallyGroupKind.DIRECT,
                        TallyGroupKind.GROUP);
        assertThat(report.ledgers().getFirst().amount())
                .as("largest ledger first")
                .isEqualByComparingTo("450.00");
        assertThat(report.expenseCount()).isEqualTo(3);
    }

    @Test
    @DisplayName("categories come back largest first, with no category left as null")
    void categoriesAreRanked() {
        spend("Dinner", "900.00", TODAY, "Food", appa, amma);        // 450
        spend("Taxi", "200.00", TODAY, "Travel", appa, amma);        // 100
        spend("Odds and ends", "60.00", TODAY, null, appa, amma);    //  30

        assertThat(report(TallyReportPeriod.MONTH).categories())
                .extracting(TallyReportCategoryDto::category)
                .containsExactly("Food", "Travel", null);
    }

    /* ============================== the chart ============================== */

    @Test
    @DisplayName("a month is charted per day, quiet days included")
    void bucketsCoverTheWholePeriod() {
        spend("Dinner", "900.00", LocalDate.of(2026, 9, 3), "Food", appa, amma);

        var buckets = report(TallyReportPeriod.MONTH).buckets();

        // Every day of September, not just the one with a receipt: the gaps between spends are
        // most of what the chart is showing.
        assertThat(buckets).hasSize(30);
        assertThat(buckets.getFirst().start()).isEqualTo(LocalDate.of(2026, 9, 1));
        assertThat(buckets.get(2).amount()).isEqualByComparingTo("450.00");
        assertThat(buckets).filteredOn(b -> b.amount().signum() > 0).hasSize(1);
    }

    @Test
    @DisplayName("a year is charted per month")
    void yearBucketsAreMonths() {
        spend("Dinner", "900.00", LocalDate.of(2026, 2, 14), "Food", appa, amma);

        var buckets = report(TallyReportPeriod.YEAR).buckets();

        assertThat(buckets).hasSize(12);
        assertThat(buckets.get(1).amount()).isEqualByComparingTo("450.00");
        assertThat(buckets.stream().map(TallyReportBucketDto::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)).isEqualByComparingTo("450.00");
    }

    /* ============================== the window ============================== */

    @Test
    @DisplayName("last month is the comparison, and stays out of this month's total")
    void previousPeriodIsSeparate() {
        spend("August dinner", "900.00", LocalDate.of(2026, 8, 20), "Food", appa, amma);
        spend("September dinner", "300.00", TODAY, "Food", appa, amma);

        var report = report(TallyReportPeriod.MONTH);

        assertThat(report.total()).isEqualByComparingTo("150.00");
        assertThat(report.previousTotal()).isEqualByComparingTo("450.00");
        assertThat(report.from()).isEqualTo(LocalDate.of(2026, 9, 1));
        assertThat(report.to()).isEqualTo(LocalDate.of(2026, 9, 30));
    }

    @Test
    @DisplayName("the daily average divides by the days so far, not the whole month")
    void dailyAverageUsesElapsedDays() {
        spend("Dinner", "900.00", TODAY, "Food", appa, amma);

        // ₹450 over the 15 days of September that have happened. Dividing by 30 would report
        // ₹15 a day halfway through the month and read as thrift rather than as arithmetic.
        assertThat(report(TallyReportPeriod.MONTH).dailyAverage()).isEqualByComparingTo("30.00");
    }

    @Test
    @DisplayName("there is no step forward out of the current period")
    void noForwardStepIntoAnEmptyFuture() {
        assertThat(report(TallyReportPeriod.MONTH).nextAnchor()).isNull();
        assertThat(report(TallyReportPeriod.MONTH).previousAnchor())
                .isEqualTo(LocalDate.of(2026, 8, 1));

        var august = reports.spending(appaUser, TallyReportPeriod.MONTH, LocalDate.of(2026, 8, 10));
        assertThat(august.nextAnchor()).isEqualTo(LocalDate.of(2026, 9, 1));
    }

    /* ============================== what counts ============================== */

    @Test
    @DisplayName("a removed expense leaves the report")
    void voidedExpensesDoNotCount() {
        String id = spend("Dinner", "900.00", TODAY, "Food", appa, amma);
        spend("Lunch", "100.00", TODAY, "Food", appa, amma);

        expenseService.voidExpense(appaUser, id);

        var report = report(TallyReportPeriod.MONTH);
        assertThat(report.total()).isEqualByComparingTo("50.00");
        assertThat(report.expenseCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("leaving a group does not un-eat the dinners")
    void departedMembershipsStillCount() {
        spend("Dinner", "900.00", LocalDate.of(2026, 9, 2), "Food", appa, amma);

        // Status is flipped directly: getting here through removal needs the balance settled
        // first, and that is TallyRosterTest's subject. What matters here is only that the
        // report does not filter on it -- otherwise last year's total quietly drops every time
        // somebody tidies up a group.
        TallyGroupMemberEntity mine = memberRepo.findById(appa).orElseThrow();
        mine.setStatus(TallyMemberStatus.LEFT);
        em.flush();

        assertThat(report(TallyReportPeriod.MONTH).total()).isEqualByComparingTo("450.00");
    }

    @Test
    @DisplayName("somebody with no ledgers gets an empty report, not an error")
    void nothingToReportOn() {
        Long newcomer = user(firstRole(), "Newcomer");
        em.flush();

        var report = reports.spending(newcomer, TallyReportPeriod.MONTH, TODAY);

        assertThat(report.total()).isEqualByComparingTo("0");
        assertThat(report.previousTotal()).isEqualByComparingTo("0");
        assertThat(report.dailyAverage()).isEqualByComparingTo("0");
        assertThat(report.expenseCount()).isZero();
        assertThat(report.categories()).isEmpty();
        assertThat(report.ledgers()).isEmpty();
        assertThat(report.biggest()).isNull();
        // Still a real window, so the screen has something to draw.
        assertThat(report.buckets()).hasSize(30);
        assertThat(report.from()).isEqualTo(LocalDate.of(2026, 9, 1));
    }

    @Test
    @DisplayName("the biggest single item is the caller's share of it, not the bill")
    void biggestIsAShare() {
        spend("Dinner", "900.00", TODAY, "Food", appa, amma);
        spend("Lunch", "100.00", TODAY, "Food", appa, amma);

        assertThat(report(TallyReportPeriod.MONTH).biggest()).satisfies(biggest -> {
            assertThat(biggest.description()).isEqualTo("Dinner");
            assertThat(biggest.amount()).isEqualByComparingTo("450.00");
        });
    }

    @Test
    @DisplayName("the day boundary is IST, whatever zone the clock came with")
    void todayIsAnIndianDay() {
        // Seven in the evening UTC on the last of September is half past midnight on the 1st of
        // October in India. Read in the server's own zone this is still September, so somebody
        // opening the app just after midnight would be shown last month and told it was this one.
        var justAfterMidnightInIndia = reportsAt(
                Clock.fixed(Instant.parse("2026-09-30T19:00:00Z"), ZoneOffset.UTC));

        // No anchor, so the period is whatever the service thinks today is.
        var report = justAfterMidnightInIndia.spending(appaUser, TallyReportPeriod.MONTH, null);

        assertThat(report.from()).isEqualTo(LocalDate.of(2026, 10, 1));
        assertThat(report.nextAnchor()).as("October has not finished").isNull();
    }

    @Test
    @DisplayName("a week runs Monday to Sunday")
    void weeklyWindow() {
        var report = report(TallyReportPeriod.WEEK);

        // 15 September 2026 is a Tuesday, so its week opened on the 14th.
        assertThat(report.from()).isEqualTo(LocalDate.of(2026, 9, 14));
        assertThat(report.to()).isEqualTo(LocalDate.of(2026, 9, 20));
        assertThat(report.buckets()).hasSize(7);
    }

    /* ============================== one group ============================== */

    @Test
    @DisplayName("a group's total is the whole bill, not the caller's slice of it")
    void groupTotalIsTheWholeBill() {
        // The same expense the personal report calls 450. Here the question is what the group
        // spent, so it is 900 -- and getting these two the same way round is the whole reason
        // there are two reports rather than one with a flag.
        spend("Dinner", "900.00", TODAY, "Food", appa, amma);

        var report = reports.group(appaUser, groupId, TallyReportPeriod.MONTH, TODAY);

        assertThat(report.total()).isEqualByComparingTo("900.00");
        assertThat(report.myShare())
                .as("the caller can still find themselves in it")
                .isEqualByComparingTo("450.00");
    }

    @Test
    @DisplayName("each member's paid and consumed are both reported, and they differ")
    void paidAndConsumedAreSeparate() {
        // Appa fronts the lot and eats half. That gap is the whole story of a shared ledger, and
        // a report showing only one of the two columns hides it.
        spend("Dinner", "900.00", TODAY, "Food", appa, amma);

        var rows = reports.group(appaUser, groupId, TallyReportPeriod.MONTH, TODAY).members();

        assertThat(rows).hasSize(2);
        assertThat(rows).anySatisfy(row -> {
            assertThat(row.name()).isEqualTo("Appa");
            assertThat(row.paid()).isEqualByComparingTo("900.00");
            assertThat(row.consumed()).isEqualByComparingTo("450.00");
        });
        assertThat(rows).anySatisfy(row -> {
            assertThat(row.name()).isEqualTo("Amma");
            assertThat(row.paid()).isEqualByComparingTo("0");
            assertThat(row.consumed()).isEqualByComparingTo("450.00");
        });
    }

    @Test
    @DisplayName("only members who paid or consumed something show up")
    void quietMembersAreNotPadding() {
        String ghost = memberService.add(appaUser, groupId,
                new AddMemberRequest(null, "Guest", null)).id();
        spend("Dinner", "900.00", TODAY, "Food", appa, amma);

        var rows = reports.group(appaUser, groupId, TallyReportPeriod.MONTH, TODAY).members();

        assertThat(rows).extracting(TallyGroupReportMemberDto::memberId).doesNotContain(ghost);
    }

    @Test
    @DisplayName("settling up sits beside the spending, never inside it")
    void settlementsAreNotSpending() {
        spend("Dinner", "900.00", TODAY, "Food", appa, amma);
        settlementService.record(appaUser, groupId,
                new RecordSettlementRequest(amma, appa, bd("450.00"), "UPI", null, null));

        var report = reports.group(appaUser, groupId, TallyReportPeriod.MONTH, TODAY);

        // Amma handing 450 back is the dinner being paid for, not another 450 of dinner. Adding
        // it to the total would book every shared bill twice over.
        assertThat(report.total()).isEqualByComparingTo("900.00");
        assertThat(report.settled()).isEqualByComparingTo("450.00");
    }

    @Test
    @DisplayName("a settlement on the last day of the period still counts")
    void settlementsUseTheWholeLastDay() {
        // settled_at is an instant while the period is a pair of dates, so the last day has to
        // be widened to its end. A naive `<= to at midnight` drops everything after 00:00 on the
        // 30th -- which is most of the 30th.
        spend("Dinner", "900.00", TODAY, "Food", appa, amma);
        settlementService.record(appaUser, groupId, new RecordSettlementRequest(
                amma, appa, bd("450.00"), "UPI",
                Instant.parse("2026-09-30T18:00:00Z"), null));

        assertThat(reports.group(appaUser, groupId, TallyReportPeriod.MONTH, TODAY).settled())
                .isEqualByComparingTo("450.00");
    }

    @Test
    @DisplayName("somebody who is not in the group cannot read its report")
    void nonMembersGetNothing() {
        // The module's rule everywhere: not a member means the group does not exist, rather than
        // a 403 that confirms it does.
        assertThatThrownBy(() -> reports.group(outsider, groupId, TallyReportPeriod.MONTH, TODAY))
                .isInstanceOf(DbWorldException.class);
    }

    @Test
    @DisplayName("an archived group is still readable -- a finished trip is the point of a report")
    void archivedGroupsStillReport() {
        spend("Dinner", "900.00", TODAY, "Food", appa, amma);
        groupService.update(appaUser, groupId,
                new UpdateGroupRequest("Home", "Family", null, null, true));

        assertThat(reports.group(appaUser, groupId, TallyReportPeriod.MONTH, TODAY).total())
                .isEqualByComparingTo("900.00");
    }

    @Test
    @DisplayName("the group chart and comparison work off full bills too")
    void groupChartAndComparison() {
        spend("August dinner", "600.00", LocalDate.of(2026, 8, 20), "Food", appa, amma);
        spend("September dinner", "900.00", LocalDate.of(2026, 9, 3), "Food", appa, amma);

        var report = reports.group(appaUser, groupId, TallyReportPeriod.MONTH, TODAY);

        assertThat(report.total()).isEqualByComparingTo("900.00");
        assertThat(report.previousTotal()).isEqualByComparingTo("600.00");
        assertThat(report.buckets()).hasSize(30);
        assertThat(report.buckets().get(2).amount()).isEqualByComparingTo("900.00");
        assertThat(report.categories()).singleElement()
                .satisfies(c -> assertThat(c.category()).isEqualTo("Food"));
        assertThat(report.biggest().amount())
                .as("the biggest is the bill, not a share of it")
                .isEqualByComparingTo("900.00");
        assertThat(report.currency()).isEqualTo("INR");
    }

    @Test
    @DisplayName("a group with nothing in the period reports zeroes, not an error")
    void quietGroup() {
        var report = reports.group(appaUser, groupId, TallyReportPeriod.MONTH, TODAY);

        assertThat(report.total()).isEqualByComparingTo("0");
        assertThat(report.myShare()).isEqualByComparingTo("0");
        assertThat(report.settled()).isEqualByComparingTo("0");
        assertThat(report.members()).isEmpty();
        assertThat(report.biggest()).isNull();
        assertThat(report.buckets()).hasSize(30);
    }

    /* ============================== fixtures ============================== */

    private TallyReportService reportsAt(Clock clock) {
        return new TallyReportService(access, memberRepo, groupRepo, expenseRepo, shareRepo,
                payerRepo, settlementRepo, clock);
    }

    private TallySpendingReportDto report(TallyReportPeriod period) {
        return reports.spending(appaUser, period, TODAY);
    }

    private String spend(String what, String total, LocalDate on, String category, String... sharedBy) {
        return spendIn(groupId, what, total, on, category, sharedBy);
    }

    private String spendIn(String group, String what, String total, LocalDate on,
                           String category, String... sharedBy) {
        var participants = Arrays.stream(sharedBy)
                .map(id -> new CreateExpenseRequest.ParticipantInput(id, null, null, null, null))
                .toList();
        var request = new CreateExpenseRequest(what, bd(total), TallyMethod.EQUAL, category,
                on, null, null,
                List.of(new CreateExpenseRequest.PayerInput(sharedBy[0], bd(total))),
                participants);
        return expenseService.create(appaUser, group, request).id();
    }

    private Long user(RoleEntity role, String firstName) {
        UserEntity u = new UserEntity();
        u.setFirstName(firstName);
        u.setEmail(firstName.toLowerCase() + "@example.test");
        u.setRole(role);
        em.persist(u);
        return u.getUserId();
    }

    private RoleEntity firstRole() {
        return em.createQuery("select r from RoleEntity r", RoleEntity.class)
                .setMaxResults(1).getSingleResult();
    }

    private static BigDecimal bd(String v) {
        return new BigDecimal(v);
    }
}
