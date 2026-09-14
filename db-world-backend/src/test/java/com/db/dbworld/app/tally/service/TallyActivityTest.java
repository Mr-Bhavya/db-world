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
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The history log, and putting a removed expense back.
 *
 * <p>The assertion that matters most is the boring-looking one: that an entry written last
 * week still says what it said last week. A log composed at read time from live rows would
 * pass every other test here and quietly rewrite itself the moment somebody is renamed.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TallyAccessService.class, TallyLedgerService.class, TallyExpenseService.class,
         TallyBalanceService.class, TallyGroupService.class, TallyMemberService.class,
         TallySettlementService.class, TallyActivityService.class,
         TallyActivityTest.CacheStubConfig.class, TallyMapperImpl.class})
@DisplayName("db-tally history")
class TallyActivityTest {

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

        var group = groupService.create(appaUser, new CreateGroupRequest("Home", "Family", null));
        groupId = group.id();
        appa = group.members().getFirst().id();
        amma = memberService.add(appaUser, groupId, new AddMemberRequest(ammaUser, null, null)).id();
    }

    private List<TallyActivityDto> feed() {
        return groupService.activity(appaUser, groupId, null, null, null).items();
    }

    private List<TallyActivityAction> actions() {
        return feed().stream().map(TallyActivityDto::action).toList();
    }

    /* ============================== what gets recorded ============================== */

    @Test
    @DisplayName("creating a group and adding somebody both land in the log")
    void theBasicsAreRecorded() {
        assertThat(actions()).containsExactly(
                TallyActivityAction.MEMBER_ADDED,      // newest first
                TallyActivityAction.GROUP_CREATED);
        assertThat(feed().getLast().summary()).isEqualTo("Created Home");
        assertThat(feed().getFirst().summary()).isEqualTo("Added Amma");
        assertThat(feed().getFirst().actorName()).isEqualTo("Appa");
    }

    @Test
    @DisplayName("an expense records what it was and what it cost")
    void expenseAdded() {
        spend("Groceries", "840.00");

        assertThat(feed().getFirst()).satisfies(entry -> {
            assertThat(entry.action()).isEqualTo(TallyActivityAction.EXPENSE_ADDED);
            assertThat(entry.summary()).isEqualTo("Added Groceries for ₹840.00");
            assertThat(entry.subjectType()).isEqualTo(TallyActivitySubject.EXPENSE);
        });
    }

    @Test
    @DisplayName("a correction is ONE entry, not a removal plus an addition")
    void correctionIsASingleEvent() {
        // replace() voids and re-posts internally. If those private steps logged, every
        // correction would read as three unrelated events and the feed would be unusable.
        String id = spend("Groceries", "840.00");
        expenseService.replace(appaUser, id, request("Groceries", "890.00"));

        assertThat(actions()).startsWith(
                TallyActivityAction.EXPENSE_CORRECTED,
                TallyActivityAction.EXPENSE_CORRECTED);   // one against each id, see below
        assertThat(actions()).doesNotContain(TallyActivityAction.EXPENSE_REMOVED);

        var entry = feed().getFirst();
        assertThat(entry.summary()).isEqualTo("Corrected Groceries from ₹840.00 to ₹890.00");
        assertThat(entry.detail()).contains("Amount: ₹840.00 → ₹890.00");
    }

    @Test
    @DisplayName("only the fields that actually moved appear in the detail")
    void unchangedFieldsAreNotNoise() {
        // A PATCH carries every field whether or not it was touched, and "Name: Home → Home"
        // in a log is noise that hides the one line somebody needs to see.
        // Same name, same type, a genuinely different icon. Deliberately NOT the house: the
        // group is called "Home", so the server already guessed that one and setting it again
        // would change nothing — which is the very case this test is about.
        groupService.update(appaUser, groupId,
                new UpdateGroupRequest("Home", "Family", "🐾", null, false));

        var updates = feed().stream()
                .filter(e -> e.action() == TallyActivityAction.GROUP_UPDATED).toList();
        assertThat(updates).singleElement()
                .satisfies(e -> assertThat(e.detail()).doesNotContain("Name:").contains("Icon:"));
    }

    @Test
    @DisplayName("changing who pays for somebody is its own event, not a generic update")
    void delegationIsItsOwnEvent() {
        String kid = memberService.add(appaUser, groupId, new AddMemberRequest(null, "Kid", null)).id();
        memberService.update(appaUser, groupId, kid,
                new UpdateMemberRequest(null, null, appa, false));

        assertThat(feed().getFirst()).satisfies(entry -> {
            assertThat(entry.action()).isEqualTo(TallyActivityAction.DELEGATION_SET);
            assertThat(entry.summary()).isEqualTo("Appa now pays for Kid");
        });

        memberService.update(appaUser, groupId, kid, new UpdateMemberRequest(null, null, null, true));
        assertThat(feed().getFirst().action()).isEqualTo(TallyActivityAction.DELEGATION_CLEARED);
    }

    @Test
    @DisplayName("payments and their reversals are both recorded, by name")
    void settlementsAreRecorded() {
        spend("Groceries", "100.00");
        var payment = settlementService.record(ammaUser, groupId,
                new RecordSettlementRequest(amma, appa, bd("50.00"), "UPI", null, null));

        assertThat(feed().getFirst().summary()).isEqualTo("Amma paid Appa ₹50.00");

        settlementService.reverse(ammaUser, payment.id());
        assertThat(feed().getFirst()).satisfies(entry -> {
            assertThat(entry.action()).isEqualTo(TallyActivityAction.SETTLEMENT_REVERSED);
            assertThat(entry.summary()).contains("Took back ₹50.00");
        });
    }

    /* ============================== the entry does not change ============================== */

    @Test
    @DisplayName("renaming somebody does NOT rewrite what the log already said about them")
    void entriesAreSnapshotsNotJoins() {
        // The whole reason the summary and the actor's name are stored as text. Compose them
        // at read time from ids and every past entry silently re-narrates itself.
        memberService.update(appaUser, groupId, amma,
                new UpdateMemberRequest("Amma D", null, null, false));

        var joining = feed().stream()
                .filter(e -> e.action() == TallyActivityAction.MEMBER_ADDED)
                .findFirst().orElseThrow();
        assertThat(joining.summary())
                .as("she was called Amma when she joined, and that is what happened")
                .isEqualTo("Added Amma");
    }

    @Test
    @DisplayName("correcting an expense does not rewrite the entry recording the old amount")
    void correctionDoesNotRewriteHistory() {
        String id = spend("Groceries", "840.00");
        expenseService.replace(appaUser, id, request("Groceries", "890.00"));

        var added = feed().stream()
                .filter(e -> e.action() == TallyActivityAction.EXPENSE_ADDED)
                .findFirst().orElseThrow();
        assertThat(added.summary()).isEqualTo("Added Groceries for ₹840.00");
    }

    /* ============================== restore ============================== */

    @Test
    @DisplayName("a removed expense can be put back, and the money comes back with it")
    void restorePutsTheMoneyBack() {
        String id = spend("Dinner", "100.00");
        assertThat(balanceService.netOf(groupId, amma)).isEqualByComparingTo("-50.00");

        expenseService.voidExpense(appaUser, id);
        assertThat(balanceService.netOf(groupId, amma)).isEqualByComparingTo("0");

        var copy = expenseService.restore(appaUser, id);

        assertThat(copy.id()).as("a fresh copy, because the reversal cannot be un-written")
                .isNotEqualTo(id);
        assertThat(copy.totalAmount()).isEqualByComparingTo("100.00");
        assertThat(balanceService.netOf(groupId, amma)).isEqualByComparingTo("-50.00");
        assertThat(em.find(TallyExpenseEntity.class, id).getStatus())
                .as("the removed one stays removed")
                .isEqualTo(TallyExpenseStatus.VOIDED);
    }

    @Test
    @DisplayName("the restored copy keeps the original's split exactly, not today's rules")
    void restoreReproducesTheOriginalSplit() {
        // Re-deriving would apply the group's CURRENT delegations to an expense from before
        // they changed, which is exactly what snapshotting exists to prevent.
        String kid = memberService.add(appaUser, groupId, new AddMemberRequest(null, "Kid", null)).id();
        memberService.update(appaUser, groupId, kid, new UpdateMemberRequest(null, null, appa, false));

        String id = expenseService.create(appaUser, groupId, new CreateExpenseRequest(
                "Lunch", bd("90.00"), TallyMethod.EQUAL, null, LocalDate.of(2026, 9, 1), null, null,
                List.of(new CreateExpenseRequest.PayerInput(amma, bd("90.00"))),
                List.of(part(appa), part(kid), part(amma)))).id();

        expenseService.voidExpense(appaUser, id);
        // Kid now pays their own way -- but the restored copy must not adopt that.
        memberService.update(appaUser, groupId, kid, new UpdateMemberRequest(null, null, null, true));

        var copy = expenseService.restore(appaUser, id);
        assertThat(copy.shares())
                .filteredOn(share -> share.beneficiaryMemberId().equals(kid))
                .singleElement()
                .satisfies(share -> assertThat(share.owedByMemberId())
                        .as("the snapshot said Appa paid for Kid, and it still does")
                        .isEqualTo(appa));
    }

    @Test
    @DisplayName("restore is offered once, and refused the second time")
    void restoreIsNotRepeatable() {
        // It posts a copy, so without the guard a second tap silently books the expense twice
        // and the duplicate looks every bit as real as the first.
        String id = spend("Dinner", "100.00");
        expenseService.voidExpense(appaUser, id);

        assertThat(feed().getFirst().canRestore()).isTrue();
        expenseService.restore(appaUser, id);

        assertThat(feed().stream()
                .filter(e -> e.action() == TallyActivityAction.EXPENSE_REMOVED)
                .findFirst().orElseThrow().canRestore())
                .as("the offer is withdrawn once it has been taken")
                .isFalse();

        assertThatThrownBy(() -> expenseService.restore(appaUser, id))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("already been put back");
    }

    @Test
    @DisplayName("an expense that was never removed cannot be restored")
    void cannotRestoreALiveExpense() {
        String id = spend("Dinner", "100.00");
        assertThatThrownBy(() -> expenseService.restore(appaUser, id))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("has not been removed");
    }

    /* ============================== reading it ============================== */

    @Test
    @DisplayName("history stays readable once the group is archived")
    void archivedGroupsKeepTheirHistory() {
        // Most of the reason to archive rather than delete.
        groupService.update(appaUser, groupId, new UpdateGroupRequest(null, null, null, true, true));

        assertThat(feed()).isNotEmpty();
        assertThat(actions()).contains(TallyActivityAction.GROUP_ARCHIVED);
    }

    @Test
    @DisplayName("paging walks every entry exactly once, despite identical timestamps")
    void pagingIsStableAcrossIdenticalTimestamps() {
        // One action writes several rows in the same instant, so createdAt alone is not a
        // total order and the id in the cursor is doing real work.
        for (int i = 0; i < 12; i++) spend("Chai " + i, "30.00");

        var seen = new java.util.ArrayList<String>();
        var page = groupService.activity(appaUser, groupId, null, null, 5);
        while (true) {
            page.items().forEach(e -> seen.add(e.id()));
            if (!page.hasMore()) break;
            page = groupService.activity(appaUser, groupId, page.nextCursorAt(), page.nextCursorId(), 5);
        }
        assertThat(seen).doesNotHaveDuplicates().hasSize(feedSize());
    }

    @Test
    @DisplayName("a non-member cannot read the history")
    void outsidersSeeNothing() {
        assertThatThrownBy(() -> groupService.activity(outsider, groupId, null, null, null))
                .isInstanceOf(DbWorldException.class)
                .satisfies(e -> assertThat(((DbWorldException) e).getHttpStatus().value()).isEqualTo(404));
    }

    /* ============================== fixtures ============================== */

    private int feedSize() {
        return groupService.activity(appaUser, groupId, null, null, 150).items().size();
    }

    private Long user(RoleEntity role, String firstName) {
        UserEntity u = new UserEntity();
        u.setFirstName(firstName);
        u.setEmail(firstName.toLowerCase() + "@example.test");
        u.setRole(role);
        em.persist(u);
        return u.getUserId();
    }

    private static CreateExpenseRequest.ParticipantInput part(String memberId) {
        return new CreateExpenseRequest.ParticipantInput(memberId, null, null, null, null);
    }

    private CreateExpenseRequest request(String what, String total) {
        return new CreateExpenseRequest(what, bd(total), TallyMethod.EQUAL, null,
                LocalDate.of(2026, 9, 1), null, null,
                List.of(new CreateExpenseRequest.PayerInput(appa, bd(total))),
                List.of(part(appa), part(amma)));
    }

    private String spend(String what, String total) {
        return expenseService.create(appaUser, groupId, request(what, total)).id();
    }

    private static BigDecimal bd(String v) {
        return new BigDecimal(v);
    }
}
