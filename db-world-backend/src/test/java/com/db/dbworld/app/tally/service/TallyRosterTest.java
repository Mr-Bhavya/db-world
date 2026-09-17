package com.db.dbworld.app.tally.service;

import com.db.dbworld.app.tally.dto.CreateExpenseRequest;
import com.db.dbworld.app.tally.dto.CreateExpenseRequest.ParticipantInput;
import com.db.dbworld.app.tally.dto.CreateExpenseRequest.PayerInput;
import com.db.dbworld.app.tally.dto.AddMemberRequest;
import com.db.dbworld.app.tally.dto.CreateDirectRequest;
import com.db.dbworld.app.tally.dto.CreateGroupRequest;
import com.db.dbworld.app.tally.dto.TallyGroupDetailDto;
import com.db.dbworld.app.tally.dto.TallyMemberDto;
import com.db.dbworld.app.tally.dto.UpdateGroupRequest;
import com.db.dbworld.app.tally.dto.UpdateMemberRequest;
import com.db.dbworld.app.tally.entity.*;
import com.db.dbworld.app.tally.mapper.TallyMapperImpl;
import com.db.dbworld.app.tally.repository.*;
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
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The roster: who is in a group, who pays for whom, and what happens when somebody leaves or a
 * ghost turns out to be a real person.
 *
 * <p>Most of what is asserted here is a <em>refusal</em>. That is the shape of the module — the
 * money arithmetic is covered by {@link TallyMoneyFlowTest}, and what is left is a set of rules
 * whose entire job is to stop a balance becoming unreachable: you cannot remove somebody who is
 * owed money, you cannot leave a group without an owner, you cannot build a delegation chain,
 * and you cannot merge two people whose rows would collide.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TallyAccessService.class, TallyLedgerService.class, TallyExpenseService.class,
         TallyBalanceService.class, TallyActivityService.class, TallyGroupService.class, TallyMemberService.class,
         TallyRosterTest.CacheStubConfig.class, TallyMapperImpl.class})
@DisplayName("db-tally roster")
class TallyRosterTest {

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
    @Autowired private TallyGroupMemberRepository members;
    @Autowired private TallyLedgerEntryRepository ledger;
    @Autowired private TallyExpensePayerRepository payers;
    @Autowired private TallyExpenseShareRepository shares;
    @Autowired private TallySettlementRepository settlements;
    @Autowired private TallyLedgerService ledgerService;

    private Long appaUser;
    private Long ammaUser;
    private Long outsider;
    private String groupId;
    private String appa;

    @BeforeEach
    void setUp() {
        // The db-world ACCOUNT role, which is unrelated to TallyMemberRole -- the group's own
        // OWNER/MEMBER. VIEWER here so the two never look like the same idea in this test.
        RoleEntity role = new RoleEntity();
        role.setName(Role.VIEWER);
        em.persist(role);

        appaUser = user(role, "Appa", "Dudhia");
        ammaUser = user(role, "Amma", "Dudhia");
        outsider = user(role, "Someone", "Else");
        em.flush();

        TallyGroupDetailDto group = groupService.create(appaUser, new CreateGroupRequest("Home", "Family", null));
        groupId = group.id();
        appa = group.members().getFirst().id();
    }

    /* ============================== creating ============================== */

    @Test
    @DisplayName("creating a group puts the creator in it as the owner")
    void creatorBecomesOwner() {
        // The membership row is the only thing that grants access; createdByUserId grants
        // nothing. Without it the creator could not see the group they just made.
        assertThat(groupService.get(appaUser, groupId).members())
                .singleElement()
                .satisfies(m -> {
                    assertThat(m.userId()).isEqualTo(appaUser);
                    assertThat(m.role()).isEqualTo(TallyMemberRole.OWNER);
                    assertThat(m.displayName()).isEqualTo("Appa Dudhia");
                    assertThat(m.ghost()).isFalse();
                });
    }

    @Test
    @DisplayName("my groups lists what I am in, with my own balance")
    void listMineCarriesMyBalance() {
        String amma = addRealMember(ammaUser);
        spend("Groceries", "100.00", appa, appa, amma);

        assertThat(groupService.listMine(appaUser)).singleElement().satisfies(g -> {
            assertThat(g.name()).isEqualTo("Home");
            assertThat(g.memberCount()).isEqualTo(2);
            assertThat(g.myBalance()).isEqualByComparingTo("50.00");
        });
        assertThat(groupService.listMine(ammaUser)).singleElement()
                .satisfies(g -> assertThat(g.myBalance()).isEqualByComparingTo("-50.00"));

        // Never joined anything: an empty list, not somebody else's group.
        assertThat(groupService.listMine(outsider)).isEmpty();
    }

    /* ============================== adding ============================== */

    @Test
    @DisplayName("a ghost joins with nothing but a name")
    void ghostNeedsOnlyAName() {
        TallyMemberDto kid = memberService.add(appaUser, groupId,
                new AddMemberRequest(null, "Kid", null));

        assertThat(kid.ghost()).isTrue();
        assertThat(kid.userId()).isNull();
        assertThat(kid.status()).isEqualTo(TallyMemberStatus.ACTIVE);
    }

    @Test
    @DisplayName("a ghost without a name is refused")
    void ghostWithoutNameRejected() {
        assertThatThrownBy(() -> memberService.add(appaUser, groupId, new AddMemberRequest(null, "  ", null)))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("needs a name");
    }

    @Test
    @DisplayName("the same account cannot be added to one group twice")
    void realUserCannotJoinTwice() {
        addRealMember(ammaUser);
        assertThatThrownBy(() -> memberService.add(appaUser, groupId, new AddMemberRequest(ammaUser, null, null)))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("already in this group");
    }

    @Test
    @DisplayName("re-adding somebody who left revives their original row, id and all")
    void rejoinIsAnUpdateNotAnInsert() {
        // The rule the whole member table is shaped around. A second row would take a new id,
        // and every share and ledger entry already written would keep pointing at the old one --
        // their history would fork and their balance would be split across two people who are
        // one. The unique key makes the INSERT fail; this makes the right thing happen instead.
        String amma = addRealMember(ammaUser);
        memberService.remove(appaUser, groupId, amma);

        TallyMemberDto rejoined = memberService.add(appaUser, groupId,
                new AddMemberRequest(ammaUser, null, null));

        assertThat(rejoined.id()).isEqualTo(amma);
        assertThat(rejoined.status()).isEqualTo(TallyMemberStatus.ACTIVE);
        assertThat(members.findByGroupId(groupId)).hasSize(2);
    }

    @Test
    @DisplayName("a deleted account cannot be added")
    void softDeletedUserRejected() {
        em.find(UserEntity.class, ammaUser).setDeletedAt(java.time.Instant.now());
        em.flush();

        assertThatThrownBy(() -> memberService.add(appaUser, groupId, new AddMemberRequest(ammaUser, null, null)))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("User not found");
    }

    /* ============================== delegation ============================== */

    @Test
    @DisplayName("nobody can pay for themselves")
    void selfDelegationRejected() {
        String kid = ghost("Kid");
        assertThatThrownBy(() -> delegate(kid, kid))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("cannot pay for themselves");
    }

    @Test
    @DisplayName("liability cannot be pointed at somebody in another group")
    void crossGroupDelegationRejected() {
        // No foreign key exists on paid_for_by_member_id, so this check is the only thing
        // stopping a member of one group becoming liable in another.
        String outsideGroup = groupService.create(ammaUser, new CreateGroupRequest("Elsewhere", null, null)).id();
        String stranger = groupService.get(ammaUser, outsideGroup).members().getFirst().id();
        String kid = ghost("Kid");

        assertThatThrownBy(() -> delegate(kid, stranger))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("not in this group");
    }

    @Test
    @DisplayName("a delegation chain is refused from either end")
    void delegationStaysDepthOne() {
        // Enforced here, when it is set, rather than when an expense uses it. Two cheap queries
        // keep the graph a depth-1 forest forever; detecting a cycle at expense-write time
        // would surface as an unrelated third party's expense refusing to save.
        String kid = ghost("Kid");
        String grandkid = ghost("Grandkid");
        delegate(kid, appa);

        // kid already delegates, so nobody may delegate TO kid.
        assertThatThrownBy(() -> delegate(grandkid, kid))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("already has somebody paying for them");

        // appa is already paying for kid, so appa may not delegate to anyone.
        assertThatThrownBy(() -> delegate(appa, grandkid))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("so somebody else cannot pay for them");
    }

    @Test
    @DisplayName("a delegation can be cleared, which null alone could not ask for")
    void delegationCanBeCleared() {
        String kid = ghost("Kid");
        delegate(kid, appa);

        // A null paidForByMemberId has to mean "leave it alone", so removing one needs its own
        // signal -- otherwise every PATCH that did not mention delegation would wipe it.
        memberService.update(appaUser, groupId, kid, new UpdateMemberRequest(null, null, null, false));
        assertThat(em.find(TallyGroupMemberEntity.class, kid).getPaidForByMemberId()).isEqualTo(appa);

        memberService.update(appaUser, groupId, kid, new UpdateMemberRequest(null, null, null, true));
        assertThat(em.find(TallyGroupMemberEntity.class, kid).getPaidForByMemberId()).isNull();
    }

    /* ============================== removing ============================== */

    @Test
    @DisplayName("somebody who is owed money cannot be removed, and the amount is named")
    void removalRefusedWhileMoneyIsOutstanding() {
        // The most important rule in the module. Removing them would not move the money
        // anywhere -- it would just stop anyone being able to see it or settle it.
        String amma = addRealMember(ammaUser);
        String kid = ghost("Kid");
        // Amma fronts 100 for herself and the child, so she is owed 50 and the child owes 50.
        // Neither is the sole owner, so the balance rule is what answers here rather than the
        // last-owner rule -- both refuse, and the test would not be testing this one otherwise.
        spend("Groceries", "100.00", amma, kid, amma);

        assertThatThrownBy(() -> memberService.remove(appaUser, groupId, amma))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("50.00")
                .hasMessageContaining("still owed");

        assertThatThrownBy(() -> memberService.remove(appaUser, groupId, kid))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("50.00")
                .hasMessageContaining("still owes");

        assertThat(em.find(TallyGroupMemberEntity.class, amma).isActive()).isTrue();
        assertThat(em.find(TallyGroupMemberEntity.class, kid).isActive()).isTrue();
    }

    @Test
    @DisplayName("removal succeeds once the balance is exactly zero, and clears delegations to them")
    void removalClearsInboundDelegations() {
        String kid1 = ghost("Kid 1");
        String kid2 = ghost("Kid 2");
        String amma = addRealMember(ammaUser);
        delegate(kid1, amma);
        delegate(kid2, amma);

        memberService.remove(appaUser, groupId, amma);

        assertThat(em.find(TallyGroupMemberEntity.class, amma).getStatus())
                .isEqualTo(TallyMemberStatus.LEFT);
        assertThat(em.find(TallyGroupMemberEntity.class, kid1).getPaidForByMemberId())
                .as("a dangling delegation would silently reappear in the next expense's snapshot")
                .isNull();
        assertThat(em.find(TallyGroupMemberEntity.class, kid2).getPaidForByMemberId()).isNull();
    }

    @Test
    @DisplayName("a departed member still has a name on the history they are part of")
    void departedMembersStillRender() {
        String amma = addRealMember(ammaUser);
        spend("Dinner", "100.00", appa, appa, amma);
        settleUp(amma, appa, "50.00");
        memberService.remove(appaUser, groupId, amma);

        List<TallyMemberDto> roster = groupService.get(appaUser, groupId).members();
        assertThat(roster).extracting(TallyMemberDto::displayName).contains("Amma Dudhia");
        assertThat(roster).filteredOn(m -> m.id().equals(amma))
                .singleElement()
                .satisfies(m -> assertThat(m.status()).isEqualTo(TallyMemberStatus.LEFT));
        // Active first, departed at the bottom.
        assertThat(roster.getLast().id()).isEqualTo(amma);
    }

    @Test
    @DisplayName("the last owner cannot leave or be demoted")
    void groupAlwaysKeepsAnOwner() {
        // Otherwise nobody can archive the group, remove anyone or void a mistaken expense --
        // and since promoting an owner is itself an owner action, there is no way back.
        addRealMember(ammaUser);

        assertThatThrownBy(() -> memberService.remove(appaUser, groupId, appa))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("needs an owner");
        assertThatThrownBy(() -> memberService.update(appaUser, groupId, appa,
                new UpdateMemberRequest(null, TallyMemberRole.MEMBER, null, false)))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("needs an owner");
    }

    @Test
    @DisplayName("a plain member may leave, but may not remove anybody else")
    void leavingIsYoursRemovingIsNot() {
        String amma = addRealMember(ammaUser);
        String kid = ghost("Kid");

        assertThatThrownBy(() -> memberService.remove(ammaUser, groupId, kid))
                .isInstanceOf(DbWorldException.class)
                .satisfies(e -> assertThat(((DbWorldException) e).getHttpStatus().value()).isEqualTo(403));

        assertThatCode(() -> memberService.remove(ammaUser, groupId, amma)).doesNotThrowAnyException();
    }

    /* ============================== ghost claim ============================== */

    @Test
    @DisplayName("claiming a ghost folds its whole history into the claimer")
    void claimRepointsEveryReference() {
        // A merge rather than an update: the claimer is already in the group, so setting
        // userId on the ghost would collide with uk_tally_group_member_group_user.
        String amma = addRealMember(ammaUser);
        String ghostAmma = ghost("Amma (no account yet)");
        String kid = ghost("Kid");
        delegate(kid, ghostAmma);                                  // 8, the self-reference

        spend("Dinner", "100.00", ghostAmma, ghostAmma, appa);     // 1, 2, 3, 4, 5
        settleUp(appa, ghostAmma, "50.00");                        // 6, 7

        BigDecimal ghostBalanceBefore = ledger.netBalanceOf(groupId, ghostAmma);
        memberService.claim(ammaUser, groupId, ghostAmma);
        em.flush();
        em.clear();

        assertThat(payers.findByExpenseId(anyExpenseId())).extracting(TallyExpensePayerEntity::getMemberId)
                .containsOnly(amma);
        assertThat(shares.findByExpenseId(anyExpenseId()))
                .allSatisfy(s -> assertThat(List.of(s.getBeneficiaryMemberId(), s.getOwedByMemberId()))
                        .doesNotContain(ghostAmma));
        assertThat(ledger.findByGroupId(groupId))
                .allSatisfy(e -> assertThat(List.of(e.getFromMemberId(), e.getToMemberId()))
                        .doesNotContain(ghostAmma));
        assertThat(settlements.findByGroupIdAndStatusOrderBySettledAtDesc(groupId, TallySettlementStatus.ACTIVE))
                .allSatisfy(s -> assertThat(List.of(s.getFromMemberId(), s.getToMemberId()))
                        .doesNotContain(ghostAmma));
        assertThat(em.find(TallyGroupMemberEntity.class, kid).getPaidForByMemberId())
                .as("the self-referencing delegation is the column a merge written from memory forgets")
                .isEqualTo(amma);

        assertThat(em.find(TallyGroupMemberEntity.class, ghostAmma).getStatus())
                .isEqualTo(TallyMemberStatus.LEFT);
        assertThat(ledger.netBalanceOf(groupId, amma))
                .as("the money came across with the history")
                .isEqualByComparingTo(ghostBalanceBefore);
    }

    @Test
    @DisplayName("a claim that two rows would collide on is refused, not guessed at")
    void claimRefusedOnCollision() {
        // Both identities on one expense: repointing would make one member appear twice and hit
        // uk_tally_expense_share_expense_beneficiary. Merging would mean summing amounts and
        // picking one of two owed_by values -- guessing about somebody's money.
        String amma = addRealMember(ammaUser);
        String ghostAmma = ghost("Amma (no account yet)");
        spend("Dinner", "100.00", appa, amma, ghostAmma);

        assertThatThrownBy(() -> memberService.claim(ammaUser, groupId, ghostAmma))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("same expense");

        assertThat(em.find(TallyGroupMemberEntity.class, ghostAmma).isActive())
                .as("nothing was half-merged")
                .isTrue();
    }

    @Test
    @DisplayName("a member who already has an account cannot be claimed")
    void cannotClaimARealMember() {
        String amma = addRealMember(ammaUser);
        assertThatThrownBy(() -> memberService.claim(appaUser, groupId, amma))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("already belongs to an account");
    }

    /* ============================== one-to-one ledgers ============================== */

    @Test
    @DisplayName("a direct ledger is a two-person group that reads as the other person")
    void directLedgerIsJustTheTwoOfYou() {
        // The whole feature is a presentation change over the existing model -- no second set
        // of tables, no second copy of the arithmetic to keep in agreement.
        var ledger = groupService.createDirect(appaUser, new CreateDirectRequest(ammaUser, null));

        assertThat(ledger.kind()).isEqualTo(TallyGroupKind.DIRECT);
        assertThat(ledger.name()).isEqualTo("Amma Dudhia");
        assertThat(ledger.members()).hasSize(2)
                .extracting(TallyMemberDto::displayName)
                .containsExactlyInAnyOrder("Appa Dudhia", "Amma Dudhia");
    }

    @Test
    @DisplayName("asking twice returns the same ledger rather than a second one")
    void directLedgersAreNeverDuplicated() {
        // Two running totals with one person is the money-in-two-places failure this module is
        // arranged to prevent: you settle up on one and still owe on the other.
        var first = groupService.createDirect(appaUser, new CreateDirectRequest(ammaUser, null));
        var again = groupService.createDirect(appaUser, new CreateDirectRequest(ammaUser, null));

        assertThat(again.id()).isEqualTo(first.id());
        assertThat(groupService.listMine(appaUser))
                .filteredOn(g -> g.kind() == TallyGroupKind.DIRECT)
                .hasSize(1);
    }

    @Test
    @DisplayName("the other person does not need an account")
    void directLedgerWithSomebodyWithoutAnAccount() {
        var ledger = groupService.createDirect(appaUser, new CreateDirectRequest(null, "Auto driver"));

        assertThat(ledger.name()).isEqualTo("Auto driver");
        assertThat(ledger.members()).filteredOn(TallyMemberDto::ghost).hasSize(1);
    }

    @Test
    @DisplayName("you cannot start one with yourself")
    void directLedgerWithYourselfRefused() {
        assertThatThrownBy(() -> groupService.createDirect(appaUser, new CreateDirectRequest(appaUser, null)))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("yourself");
    }

    @Test
    @DisplayName("a third person turns it into an ordinary group, keeping everything recorded")
    void thirdPersonPromotesADirectLedger() {
        // Promoted rather than refused: "you and Amma" really does become "the flat" when
        // somebody moves in, and starting again would throw away the history.
        var ledger = groupService.createDirect(appaUser, new CreateDirectRequest(ammaUser, null));
        spendIn(ledger.id(), "Taxi", "100.00", ledger.members().getFirst().id());

        memberService.add(appaUser, ledger.id(), new AddMemberRequest(null, "Flatmate", null));

        var after = groupService.get(appaUser, ledger.id());
        assertThat(after.kind()).isEqualTo(TallyGroupKind.GROUP);
        assertThat(after.members()).hasSize(3);
        assertThat(expenseService.list(appaUser, ledger.id(), null, null, null).items())
                .as("nothing recorded before the promotion is lost")
                .hasSize(1);
    }

    @Test
    @DisplayName("a direct ledger splits, settles and closes like any other group")
    void directLedgerBehavesLikeAGroup() {
        var ledger = groupService.createDirect(appaUser, new CreateDirectRequest(ammaUser, null));
        String me = ledger.myMemberId();
        String them = ledger.members().stream()
                .filter(m -> !m.id().equals(me)).findFirst().orElseThrow().id();

        spendIn(ledger.id(), "Dinner", "100.00", me, me, them);

        assertThat(groupService.get(appaUser, ledger.id()).members())
                .filteredOn(m -> m.id().equals(them))
                .singleElement()
                .satisfies(m -> assertThat(m.balance()).isEqualByComparingTo("-50.00"));
    }

    /* ============================== your own spending ============================== */

    @Test
    @DisplayName("your own spending is a ledger with one person in it")
    void personalLedgerIsJustYou() {
        var mine = groupService.personalLedger(appaUser);

        assertThat(mine.kind()).isEqualTo(TallyGroupKind.PERSONAL);
        assertThat(mine.name()).isEqualTo("Your spending");
        assertThat(mine.members()).singleElement()
                .satisfies(m -> assertThat(m.userId()).isEqualTo(appaUser));
    }

    @Test
    @DisplayName("asking twice returns the same one, never a second")
    void personalLedgerIsNeverDuplicated() {
        // Two places to record your own spending is two monthly totals, both wrong.
        var first = groupService.personalLedger(appaUser);
        var again = groupService.personalLedger(appaUser);

        assertThat(again.id()).isEqualTo(first.id());
        assertThat(groupService.listMine(appaUser))
                .filteredOn(g -> g.kind() == TallyGroupKind.PERSONAL)
                .hasSize(1);
    }

    @Test
    @DisplayName("everyone gets their own, and cannot see anybody else's")
    void personalLedgersAreNotShared() {
        var mine = groupService.personalLedger(appaUser);
        var theirs = groupService.personalLedger(ammaUser);

        assertThat(theirs.id()).isNotEqualTo(mine.id());
        assertThatThrownBy(() -> groupService.get(ammaUser, mine.id()))
                .isInstanceOf(DbWorldException.class)
                .satisfies(e -> assertThat(((DbWorldException) e).getHttpStatus().value()).isEqualTo(404));
    }

    @Test
    @DisplayName("spending on it records the expense and leaves you at zero")
    void personalSpendingHasNoBalance() {
        // All self-owed, so the ledger writes no edges at all -- there is nobody on the other
        // end of one. The expense is still fully recorded, which is the point.
        var mine = groupService.personalLedger(appaUser);
        String me = mine.myMemberId();

        spendIn(mine.id(), "Haircut", "300.00", me);

        assertThat(expenseService.list(appaUser, mine.id(), null, null, null).items())
                .singleElement()
                .satisfies(e -> assertThat(e.totalAmount()).isEqualByComparingTo("300.00"));
        assertThat(groupService.get(appaUser, mine.id()).members())
                .singleElement()
                .satisfies(m -> assertThat(m.balance()).isEqualByComparingTo("0"));
    }

    @Test
    @DisplayName("nobody else can be added to it")
    void personalLedgerTakesNoMembers() {
        // A direct ledger is promoted when a third joins, because "you and Amma" does become
        // "the flat". "Your spending" has no such reading -- it would just be a shared ledger
        // with a misleading name.
        var mine = groupService.personalLedger(appaUser);

        assertThatThrownBy(() -> memberService.add(appaUser, mine.id(),
                new AddMemberRequest(null, "Somebody", null)))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("your own spending");
    }

    @Test
    @DisplayName("it keeps its history if you archive and come back")
    void archivedPersonalLedgerIsReused() {
        var mine = groupService.personalLedger(appaUser);
        spendIn(mine.id(), "Haircut", "300.00", mine.myMemberId());
        groupService.update(appaUser, mine.id(), new UpdateGroupRequest(null, null, null, true, true));

        var again = groupService.personalLedger(appaUser);

        assertThat(again.id()).as("the one you already have, not a fresh empty one")
                .isEqualTo(mine.id());
        assertThat(expenseService.list(appaUser, again.id(), null, null, null).items()).hasSize(1);
    }

    /* ============================== archiving ============================== */

    @Test
    @DisplayName("archiving is refused while money is outstanding, and says how much")
    void archiveRefusedWithOutstandingBalances() {
        // "Archived with money outstanding and hidden from everyone" is how a debt quietly
        // stops existing.
        String amma = addRealMember(ammaUser);
        spend("Groceries", "100.00", appa, appa, amma);

        assertThatThrownBy(() -> groupService.update(appaUser, groupId,
                new UpdateGroupRequest(null, null, null, true, false)))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("50.00");

        assertThat(groupService.get(appaUser, groupId).archived()).isFalse();
    }

    @Test
    @DisplayName("archiving anyway is allowed, but only on purpose")
    void archiveAllowedWhenAcknowledged() {
        // A group can genuinely reach a state nobody intends to settle. The rule is a speed
        // bump, not a wall -- what matters is that somebody was told the number and said yes.
        String amma = addRealMember(ammaUser);
        spend("Groceries", "100.00", appa, appa, amma);

        assertThat(groupService.update(appaUser, groupId, new UpdateGroupRequest(null, null, null, true, true))
                .archived()).isTrue();

        // Archived is closed for writes but still readable, and reopening undoes it.
        assertThatThrownBy(() -> memberService.add(appaUser, groupId, new AddMemberRequest(null, "Late", null)))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("archived");
        assertThat(groupService.update(appaUser, groupId, new UpdateGroupRequest(null, null, null, false, false))
                .archived()).isFalse();
    }

    @Test
    @DisplayName("renaming is open to any member, archiving is not")
    void archivingIsAnOwnerAction() {
        addRealMember(ammaUser);

        assertThat(groupService.update(ammaUser, groupId, new UpdateGroupRequest("Our Home", null, null, null, false))
                .name()).isEqualTo("Our Home");

        assertThatThrownBy(() -> groupService.update(ammaUser, groupId,
                new UpdateGroupRequest(null, null, null, true, false)))
                .isInstanceOf(DbWorldException.class)
                .satisfies(e -> assertThat(((DbWorldException) e).getHttpStatus().value()).isEqualTo(403));
    }

    /* ============================== authorization ============================== */

    @Test
    @DisplayName("a non-member gets 404 from every entry point, read and write alike")
    void outsidersSeeNothingAnywhere() {
        // db-tally is the first shared object in db-world, so this is written out in full. A
        // mutation answering 403 leaks exactly what a read answering 403 would: that the group
        // is real, and therefore who shares one with whom.
        String kid = ghost("Kid");

        assertThatAll404(
                () -> groupService.get(outsider, groupId),
                () -> groupService.update(outsider, groupId, new UpdateGroupRequest("Mine now", null, null, null, false)),
                () -> memberService.add(outsider, groupId, new AddMemberRequest(null, "Intruder", null)),
                () -> memberService.update(outsider, groupId, kid, new UpdateMemberRequest("Renamed", null, null, false)),
                () -> memberService.remove(outsider, groupId, kid),
                () -> memberService.claim(outsider, groupId, kid));
    }

    private static void assertThatAll404(Runnable... calls) {
        for (Runnable call : calls) {
            assertThatThrownBy(call::run)
                    .isInstanceOf(DbWorldException.class)
                    .satisfies(e -> {
                        assertThat(((DbWorldException) e).getHttpStatus().value()).isEqualTo(404);
                        assertThat(e).hasMessage("Group not found");
                    });
        }
    }

    /* ============================== fixtures ============================== */

    private Long user(RoleEntity role, String first, String last) {
        UserEntity u = new UserEntity();
        u.setFirstName(first);
        u.setLastName(last);
        u.setEmail(first.toLowerCase() + "@example.test");
        u.setRole(role);
        em.persist(u);
        return u.getUserId();
    }

    private String addRealMember(Long userId) {
        return memberService.add(appaUser, groupId, new AddMemberRequest(userId, null, null)).id();
    }

    private String ghost(String name) {
        return memberService.add(appaUser, groupId, new AddMemberRequest(null, name, null)).id();
    }

    private void delegate(String memberId, String targetId) {
        memberService.update(appaUser, groupId, memberId, new UpdateMemberRequest(null, null, targetId, false));
    }

    /** An expense paid by one member and split equally, each participant liable for their own. */
    private void spend(String what, String total, String payer, String... participants) {
        spendIn(groupId, what, total, payer, participants);
    }

    private void spendIn(String inGroup, String what, String total, String payer, String... participants) {
        expenseService.create(appaUser, inGroup, new CreateExpenseRequest(
                what, new BigDecimal(total), TallyMethod.EQUAL, null, LocalDate.of(2026, 9, 1), null, null,
                List.of(new PayerInput(payer, new BigDecimal(total))),
                (participants.length == 0 ? java.util.stream.Stream.of(payer)
                        : java.util.Arrays.stream(participants))
                        .map(p -> new ParticipantInput(p, null, null, null, p))
                        .toList()));
    }

    private void settleUp(String from, String to, String amount) {
        TallySettlementEntity s = new TallySettlementEntity();
        s.setGroupId(groupId);
        s.setFromMemberId(from);
        s.setToMemberId(to);
        s.setAmount(new BigDecimal(amount));
        s.setSettledAt(java.time.Instant.now());
        s.setRecordedByUserId(appaUser);
        settlements.save(s);
        ledgerService.postSettlement(s);
    }

    private String anyExpenseId() {
        return em.createQuery("select e.id from TallyExpenseEntity e where e.groupId = :g", String.class)
                .setParameter("g", groupId).getResultList().getFirst();
    }
}
