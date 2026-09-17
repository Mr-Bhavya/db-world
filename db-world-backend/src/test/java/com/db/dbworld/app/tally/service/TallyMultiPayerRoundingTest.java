package com.db.dbworld.app.tally.service;

import com.db.dbworld.app.tally.dto.AddMemberRequest;
import com.db.dbworld.app.tally.dto.CreateExpenseRequest;
import com.db.dbworld.app.tally.dto.CreateGroupRequest;
import com.db.dbworld.app.tally.entity.TallyMethod;
import com.db.dbworld.app.tally.mapper.TallyMapperImpl;
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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The one invariant the whole module rests on, for an expense with several payers.
 *
 * <p>Every member's ledger balance must equal what they paid minus what they owed. Nothing else
 * in db-tally is meaningful if that can drift: the balances drive who owes whom, the settle-up
 * plan, the removal guard and every report.
 *
 * <p>This case is here because a Splitwise import produced it and the import's reconciliation
 * refused to commit. Deliberately written against the ordinary services with no importer
 * involved, so that what it proves is about {@code TallyLedgerService} and the allocator rather
 * than about the importer that found it.
 *
 * <p>The shape that matters: <b>several payers who are also debtors, with a share that does not
 * divide evenly between them.</b> Three people pay 200 each toward a 600 bill; the fourth owes
 * 450 of it and the three payers owe 50 each. Splitting one debtor's 50 across three payers is
 * 16.666… per payer, so it has to round — and each payer's own portion of their own debt is then
 * dropped as a self-edge.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TallyAccessService.class, TallyLedgerService.class, TallyExpenseService.class,
         TallyBalanceService.class, TallyGroupService.class, TallyMemberService.class,
         TallyActivityService.class, TallyMultiPayerRoundingTest.CacheStubConfig.class,
         TallyMapperImpl.class})
@DisplayName("db-tally multi-payer rounding")
class TallyMultiPayerRoundingTest {

    @TestConfiguration
    static class CacheStubConfig {
        @Bean
        CacheManager cacheManager() {
            return new NoOpCacheManager();
        }
    }

    @Autowired private EntityManager em;
    @Autowired private TallyGroupService groups;
    @Autowired private TallyMemberService members;
    @Autowired private TallyExpenseService expenses;
    @Autowired private TallyBalanceService balances;

    private Long owner;
    private String groupId;
    /** Member ids sorted by id, because the allocator's tie-break is the member id. */
    private List<String> ids;

    @BeforeEach
    void setUp() {
        RoleEntity role = new RoleEntity();
        role.setName(Role.VIEWER);
        em.persist(role);
        UserEntity user = new UserEntity();
        user.setFirstName("Owner");
        user.setEmail("owner@example.test");
        user.setRole(role);
        em.persist(user);
        em.flush();
        owner = user.getUserId();

        var group = groups.create(owner, new CreateGroupRequest("Four", null, null));
        groupId = group.id();

        List<String> roster = new ArrayList<>();
        roster.add(group.myMemberId());
        for (String name : List.of("Two", "Three", "Four")) {
            roster.add(members.add(owner, groupId, new AddMemberRequest(null, name, null)).id());
        }
        // Sorted, so which member absorbs a leftover paisa is fixed rather than a fresh UUID
        // lottery on every run -- the same precaution TallyMoneyFlowTest takes.
        roster.sort(Comparator.naturalOrder());
        ids = roster;
    }

    @Test
    @DisplayName("three payers, an unevenly divisible share: every net must still be exact")
    void multiPayerNetsAreExact() {
        // 600 paid by the last three at 200 each. The first owes 450 of it; the payers owe 50
        // each. Every figure here is a whole paisa and the two halves both sum to 600.
        var request = new CreateExpenseRequest(
                "Cash to somebody", new BigDecimal("600.00"), TallyMethod.EXACT, null,
                java.time.LocalDate.of(2026, 9, 15), null, null,
                List.of(new CreateExpenseRequest.PayerInput(ids.get(1), new BigDecimal("200.00")),
                        new CreateExpenseRequest.PayerInput(ids.get(2), new BigDecimal("200.00")),
                        new CreateExpenseRequest.PayerInput(ids.get(3), new BigDecimal("200.00"))),
                List.of(part(ids.get(0), "450.00"), part(ids.get(1), "50.00"),
                        part(ids.get(2), "50.00"), part(ids.get(3), "50.00")));
        expenses.create(owner, groupId, request);

        // paid - owed, per member, which is what the ledger is supposed to encode.
        assertThat(balances.netOf(groupId, ids.get(0)))
                .as("owed 450, paid nothing").isEqualByComparingTo("-450.00");
        assertThat(balances.netOf(groupId, ids.get(1)))
                .as("paid 200, owed 50").isEqualByComparingTo("150.00");
        assertThat(balances.netOf(groupId, ids.get(2)))
                .as("paid 200, owed 50").isEqualByComparingTo("150.00");
        assertThat(balances.netOf(groupId, ids.get(3)))
                .as("paid 200, owed 50").isEqualByComparingTo("150.00");
    }

    @Test
    @DisplayName("and the group still sums to zero, whatever the individual nets came out as")
    void theGroupStillClosesToZero() {
        var request = new CreateExpenseRequest(
                "Cash to somebody", new BigDecimal("600.00"), TallyMethod.EXACT, null,
                java.time.LocalDate.of(2026, 9, 15), null, null,
                List.of(new CreateExpenseRequest.PayerInput(ids.get(1), new BigDecimal("200.00")),
                        new CreateExpenseRequest.PayerInput(ids.get(2), new BigDecimal("200.00")),
                        new CreateExpenseRequest.PayerInput(ids.get(3), new BigDecimal("200.00"))),
                List.of(part(ids.get(0), "450.00"), part(ids.get(1), "50.00"),
                        part(ids.get(2), "50.00"), part(ids.get(3), "50.00")));
        expenses.create(owner, groupId, request);

        BigDecimal sum = ids.stream()
                .map(id -> balances.netOf(groupId, id))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // This passes even when the individual nets are a paisa out, which is exactly why it is
        // not sufficient on its own -- a paisa moved from one member to another still sums to
        // zero. Kept as the weaker companion to the assertion above.
        assertThat(sum).isEqualByComparingTo("0.00");
    }

    private static CreateExpenseRequest.ParticipantInput part(String memberId, String exact) {
        return new CreateExpenseRequest.ParticipantInput(
                memberId, new BigDecimal(exact), null, null, null);
    }
}
