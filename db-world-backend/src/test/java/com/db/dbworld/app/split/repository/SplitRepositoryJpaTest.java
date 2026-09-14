package com.db.dbworld.app.split.repository;

import com.db.dbworld.app.split.entity.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.cache.CacheManager;
import org.springframework.cache.support.NoOpCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.data.domain.Limit;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Executes the db-split queries, rather than merely parsing them.
 *
 * <p>Booting the JPA slice already validates every {@code @Query} string when the repository
 * beans are created, and {@code SplitSchemaJpaTest} covers the DDL. Neither runs a statement.
 * The bugs this module can actually ship are in the <em>execution</em>: an aggregation that
 * returns the wrong shape, a keyset predicate that skips a row when two expenses share a date,
 * and the bulk-update form that MySQL rejects with error 1093 while H2 accepts it.
 *
 * <p>H2 is not MySQL, so this cannot prove MySQL-compatibility. It can prove the queries run at
 * all and return the right numbers, which is most of the distance — and the one shape known to
 * differ between the two is written to avoid the difference rather than to detect it.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@DisplayName("db-split repositories")
class SplitRepositoryJpaTest {

    @TestConfiguration
    static class CacheStubConfig {
        @Bean
        CacheManager cacheManager() {
            return new NoOpCacheManager();
        }
    }

    @Autowired private EntityManager em;
    @Autowired private SplitGroupRepository groups;
    @Autowired private SplitGroupMemberRepository members;
    @Autowired private SplitExpenseRepository expenses;
    @Autowired private SplitExpensePayerRepository payers;
    @Autowired private SplitExpenseShareRepository shares;
    @Autowired private SplitLedgerEntryRepository ledger;
    @Autowired private SplitSettlementRepository settlements;

    /* ============================== balances ============================== */

    @Test
    @DisplayName("credits and debits aggregate per member, and net is their difference")
    void balanceAggregation() {
        String g = group();
        String amma = member(g, "Amma");
        String appa = member(g, "Appa");
        String kid  = member(g, "Kid");

        // Amma is owed 300 by Appa and 200 by Kid; Appa is owed 50 by Kid.
        entry(g, appa, amma, "300.00");
        entry(g, kid,  amma, "200.00");
        entry(g, kid,  appa, "50.00");
        em.flush();
        em.clear();

        assertThat(totals(ledger.sumCreditsByGroup(g)))
                .containsOnly(entryOf(amma, "500.00"), entryOf(appa, "50.00"));
        assertThat(totals(ledger.sumDebitsByGroup(g)))
                .containsOnly(entryOf(appa, "300.00"), entryOf(kid, "250.00"));

        assertThat(ledger.netBalanceOf(g, amma)).isEqualByComparingTo("500.00");
        assertThat(ledger.netBalanceOf(g, appa)).isEqualByComparingTo("-250.00");
        assertThat(ledger.netBalanceOf(g, kid)).isEqualByComparingTo("-250.00");
    }

    @Test
    @DisplayName("a member with no entries nets to zero rather than null")
    void netBalanceOfUntouchedMember() {
        // The removal guard compares this against zero. A null here would NPE on the one check
        // that stands between a departing member and money disappearing.
        String g = group();
        assertThat(ledger.netBalanceOf(g, member(g, "Nobody"))).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("a reversal cancels its original, because it is the same edge swapped")
    void reversalCancels() {
        String g = group();
        String a = member(g, "A");
        String b = member(g, "B");

        SplitLedgerEntryEntity original = entry(g, a, b, "120.00");
        SplitLedgerEntryEntity reversal = entry(g, b, a, "120.00");
        reversal.setEntryType(SplitLedgerEntryType.REVERSAL);
        reversal.setSourceId(original.getSourceId());
        em.flush();

        // No query anywhere filters on entry_type; the pair nets out inside the plain SUM.
        assertThat(ledger.netBalanceOf(g, a)).isEqualByComparingTo("0");
        assertThat(ledger.netBalanceOf(g, b)).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("voiding can find every entry a source produced")
    void entriesBySource() {
        String g = group();
        String a = member(g, "A");
        String b = member(g, "B");
        SplitLedgerEntryEntity e1 = entry(g, a, b, "10.00");
        entry(g, a, b, "20.00").setSourceId(e1.getSourceId());
        em.flush();
        em.clear();

        assertThat(ledger.findBySourceTypeAndSourceId(SplitLedgerSourceType.EXPENSE, e1.getSourceId()))
                .hasSize(2);
    }

    /* ============================== liability vs consumption ============================== */

    @Test
    @DisplayName("the same shares report different totals by consumer and by debtor")
    void consumptionAndLiabilityDiverge() {
        // The premise of the module, as a query: the kids ate, dad pays.
        String g = group();
        String appa = member(g, "Appa");
        String kid1 = member(g, "Kid 1");
        String kid2 = member(g, "Kid 2");

        String e = expense(g, "Groceries", "300.00", LocalDate.of(2026, 9, 1));
        share(e, appa, appa, "100.00");
        share(e, kid1, appa, "100.00");
        share(e, kid2, appa, "100.00");
        em.flush();
        em.clear();

        assertThat(totals(shares.sumConsumedByGroup(g)))
                .containsOnly(entryOf(appa, "100.00"), entryOf(kid1, "100.00"), entryOf(kid2, "100.00"));
        assertThat(totals(shares.sumOwedByGroup(g)))
                .containsOnly(entryOf(appa, "300.00"));
    }

    @Test
    @DisplayName("a voided expense drops out of both share reports")
    void voidedExpensesAreExcluded() {
        String g = group();
        String a = member(g, "A");
        String e = expense(g, "Cancelled", "500.00", LocalDate.of(2026, 9, 1));
        share(e, a, a, "500.00");
        em.flush();

        assertThat(totals(shares.sumOwedByGroup(g))).containsOnly(entryOf(a, "500.00"));

        em.find(SplitExpenseEntity.class, e).setStatus(SplitExpenseStatus.VOIDED);
        em.flush();
        em.clear();

        assertThat(shares.sumOwedByGroup(g)).isEmpty();
    }

    /* ============================== keyset pagination ============================== */

    @Test
    @DisplayName("keyset paging walks every expense exactly once, ties included")
    void keysetPaginationIsStable() {
        // Three of the five share a date. Under OFFSET that is precisely where rows get
        // duplicated across pages and others never appear at all, because a DATE gives no
        // total order on its own.
        String g = group();
        LocalDate shared = LocalDate.of(2026, 9, 10);
        expense(g, "a", "10.00", shared);
        expense(g, "b", "10.00", shared);
        expense(g, "c", "10.00", shared);
        expense(g, "d", "10.00", LocalDate.of(2026, 9, 11));
        expense(g, "e", "10.00", LocalDate.of(2026, 9, 9));
        em.flush();
        em.clear();

        List<String> walked = new java.util.ArrayList<>();
        List<SplitExpenseEntity> page =
                expenses.findFirstPage(g, SplitExpenseStatus.ACTIVE, Limit.of(2));
        while (!page.isEmpty()) {
            page.forEach(x -> walked.add(x.getDescription()));
            SplitExpenseEntity last = page.getLast();
            page = expenses.findPageAfter(g, SplitExpenseStatus.ACTIVE,
                    last.getExpenseDate(), last.getId(), Limit.of(2));
        }

        assertThat(walked).hasSize(5).doesNotHaveDuplicates();
        assertThat(walked).startsWith("d");   // newest first
        assertThat(walked).endsWith("e");     // oldest last
    }

    /* ============================== delegation ============================== */

    @Test
    @DisplayName("removing a member clears the delegations pointing at them")
    void clearInboundDelegations() {
        // The bulk UPDATE that must not read its own table -- MySQL error 1093. If this is ever
        // rewritten as `where paid_for_by_member_id in (select id from split_group_member ...)`
        // it will still pass here, on H2, and fail on the Pi.
        String g = group();
        String appa = member(g, "Appa");
        String kid1 = member(g, "Kid 1");
        String kid2 = member(g, "Kid 2");
        delegate(kid1, appa);
        delegate(kid2, appa);
        em.flush();

        assertThat(members.findByGroupIdAndPaidForByMemberId(g, appa)).hasSize(2);

        assertThat(members.clearInboundDelegations(g, appa)).isEqualTo(2);
        em.clear();

        assertThat(members.findByGroupIdAndPaidForByMemberId(g, appa)).isEmpty();
        assertThat(em.find(SplitGroupMemberEntity.class, kid1).getPaidForByMemberId()).isNull();
    }

    @Test
    @DisplayName("clearing delegations in one group leaves another group's alone")
    void clearInboundDelegationsIsGroupScoped() {
        String g1 = group();
        String appa1 = member(g1, "Appa");
        String kid1 = member(g1, "Kid");
        delegate(kid1, appa1);

        String g2 = group();
        String appa2 = member(g2, "Appa");
        String kid2 = member(g2, "Kid");
        delegate(kid2, appa2);
        em.flush();

        members.clearInboundDelegations(g1, appa1);
        em.clear();

        assertThat(em.find(SplitGroupMemberEntity.class, kid2).getPaidForByMemberId())
                .isEqualTo(appa2);
    }

    /* ============================== ghost claim ============================== */

    @Test
    @DisplayName("a claim repoints all eight member references onto the survivor")
    void ghostClaimRepointsEveryReference() {
        // The ghost and the real member are both already in the group -- the case that makes a
        // claim a merge rather than an UPDATE, since setting ghost.userId would violate
        // uk_split_group_member_group_user.
        String g = group();
        String ghost = member(g, "Amma (ghost)");
        String real  = member(g, "Amma");
        em.find(SplitGroupMemberEntity.class, real).setUserId(42L);
        String other = member(g, "Appa");
        String kid   = member(g, "Kid");
        delegate(kid, ghost);                                   // 8. self-reference

        String e = expense(g, "Dinner", "100.00", LocalDate.of(2026, 9, 1));
        payer(e, ghost, "100.00");                              // 1.
        share(e, ghost, ghost, "60.00");                        // 2. and 3.
        share(e, other, other, "40.00");
        entry(g, other, ghost, "40.00");                        // 4. and 5.
        settlement(g, ghost, other, "15.00");                   // 6.
        settlement(g, other, ghost, "25.00");                   // 7.
        em.flush();

        payers.repointPayer(real, ghost);
        shares.repointBeneficiary(real, ghost);
        shares.repointOwedBy(real, ghost);
        ledger.repointFrom(real, ghost);
        ledger.repointTo(real, ghost);
        settlements.repointFrom(real, ghost);
        settlements.repointTo(real, ghost);
        members.repointDelegations(g, real, ghost);
        em.clear();

        assertThat(payers.findByExpenseId(e)).extracting(SplitExpensePayerEntity::getMemberId)
                .containsOnly(real);
        assertThat(shares.findByExpenseId(e))
                .extracting(SplitExpenseShareEntity::getBeneficiaryMemberId,
                            SplitExpenseShareEntity::getOwedByMemberId)
                .contains(org.assertj.core.groups.Tuple.tuple(real, real));
        assertThat(ledger.findByGroupId(g))
                .allSatisfy(x -> assertThat(List.of(x.getFromMemberId(), x.getToMemberId()))
                        .doesNotContain(ghost));
        assertThat(settlements.findByGroupIdAndStatusOrderBySettledAtDesc(g, SplitSettlementStatus.ACTIVE))
                .allSatisfy(s -> assertThat(List.of(s.getFromMemberId(), s.getToMemberId()))
                        .doesNotContain(ghost));
        assertThat(em.find(SplitGroupMemberEntity.class, kid).getPaidForByMemberId())
                .as("the self-referencing delegation is the one a merge forgets")
                .isEqualTo(real);
    }

    /* ============================== membership & scoping ============================== */

    @Test
    @DisplayName("the roster keeps departed members but 'my groups' does not")
    void rosterKeepsHistory() {
        String g = group();
        String stayed = member(g, "Stayed");
        String left = member(g, "Left");
        em.find(SplitGroupMemberEntity.class, left).setStatus(SplitMemberStatus.LEFT);
        em.find(SplitGroupMemberEntity.class, left).setUserId(9L);
        em.flush();
        em.clear();

        // Unfiltered, so an old expense can still render "Left" as a name.
        assertThat(members.findByGroupId(g)).extracting(SplitGroupMemberEntity::getId)
                .containsExactlyInAnyOrder(stayed, left);
        assertThat(members.findByGroupIdAndStatus(g, SplitMemberStatus.ACTIVE))
                .extracting(SplitGroupMemberEntity::getId).containsExactly(stayed);
        assertThat(members.findByUserIdAndStatus(9L, SplitMemberStatus.ACTIVE)).isEmpty();
    }

    @Test
    @DisplayName("an archived group is invisible to the write path")
    void archivedGroupIsClosedForWrites() {
        String g = group();
        assertThat(groups.findOpenById(g)).isPresent();

        em.find(SplitGroupEntity.class, g).setArchivedAt(Instant.now());
        em.flush();
        em.clear();

        assertThat(groups.findOpenById(g)).isEmpty();
        assertThat(groups.findById(g)).as("still readable, just closed").isPresent();
    }

    @Test
    @DisplayName("idempotency lookups are scoped to the group")
    void idempotencyIsPerGroup() {
        String g1 = group();
        String g2 = group();
        SplitExpenseEntity a = em.find(SplitExpenseEntity.class,
                expense(g1, "First", "10.00", LocalDate.of(2026, 9, 1)));
        a.setIdempotencyKey("retry-1");
        SplitExpenseEntity b = em.find(SplitExpenseEntity.class,
                expense(g2, "Second", "20.00", LocalDate.of(2026, 9, 1)));
        b.setIdempotencyKey("retry-1");   // same token, different group: must be allowed
        em.flush();
        em.clear();

        assertThat(expenses.findByGroupIdAndIdempotencyKey(g1, "retry-1"))
                .get().extracting(SplitExpenseEntity::getDescription).isEqualTo("First");
        assertThat(expenses.findByGroupIdAndIdempotencyKey(g2, "retry-1"))
                .get().extracting(SplitExpenseEntity::getDescription).isEqualTo("Second");
    }

    /* ============================== fixtures ============================== */

    private String group() {
        SplitGroupEntity g = new SplitGroupEntity();
        g.setName("Home");
        g.setCreatedByUserId(7L);
        em.persist(g);
        return g.getId();
    }

    private String member(String groupId, String name) {
        SplitGroupMemberEntity m = new SplitGroupMemberEntity();
        m.setGroupId(groupId);
        m.setDisplayName(name);
        em.persist(m);
        return m.getId();
    }

    private void delegate(String memberId, String toMemberId) {
        em.find(SplitGroupMemberEntity.class, memberId).setPaidForByMemberId(toMemberId);
    }

    private String expense(String groupId, String description, String total, LocalDate date) {
        SplitExpenseEntity e = new SplitExpenseEntity();
        e.setGroupId(groupId);
        e.setDescription(description);
        e.setTotalAmount(new BigDecimal(total));
        e.setExpenseDate(date);
        e.setCreatedByUserId(7L);
        em.persist(e);
        return e.getId();
    }

    private void payer(String expenseId, String memberId, String amount) {
        SplitExpensePayerEntity p = new SplitExpensePayerEntity();
        p.setExpenseId(expenseId);
        p.setMemberId(memberId);
        p.setAmount(new BigDecimal(amount));
        em.persist(p);
    }

    private void share(String expenseId, String beneficiary, String owedBy, String amount) {
        SplitExpenseShareEntity s = new SplitExpenseShareEntity();
        s.setExpenseId(expenseId);
        s.setBeneficiaryMemberId(beneficiary);
        s.setOwedByMemberId(owedBy);
        s.setAmount(new BigDecimal(amount));
        em.persist(s);
    }

    private SplitLedgerEntryEntity entry(String groupId, String from, String to, String amount) {
        SplitLedgerEntryEntity e = new SplitLedgerEntryEntity();
        e.setGroupId(groupId);
        e.setFromMemberId(from);
        e.setToMemberId(to);
        e.setAmount(new BigDecimal(amount));
        e.setSourceType(SplitLedgerSourceType.EXPENSE);
        e.setSourceId(java.util.UUID.randomUUID().toString());
        em.persist(e);
        return e;
    }

    private void settlement(String groupId, String from, String to, String amount) {
        SplitSettlementEntity s = new SplitSettlementEntity();
        s.setGroupId(groupId);
        s.setFromMemberId(from);
        s.setToMemberId(to);
        s.setAmount(new BigDecimal(amount));
        s.setSettledAt(Instant.now());
        s.setRecordedByUserId(7L);
        em.persist(s);
    }

    private static Map<String, BigDecimal> totals(List<SplitLedgerEntryRepository.MemberTotal> rows) {
        return rows.stream().collect(Collectors.toMap(
                SplitLedgerEntryRepository.MemberTotal::getMemberId,
                r -> r.getTotal().stripTrailingZeros()));
    }

    private static Map.Entry<String, BigDecimal> entryOf(String memberId, String amount) {
        return Map.entry(memberId, new BigDecimal(amount).stripTrailingZeros());
    }
}
