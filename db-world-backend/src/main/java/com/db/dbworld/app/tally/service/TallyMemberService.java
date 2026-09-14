package com.db.dbworld.app.tally.service;

import com.db.dbworld.app.tally.dto.AddMemberRequest;
import com.db.dbworld.app.tally.dto.TallyMemberDto;
import com.db.dbworld.app.tally.dto.UpdateMemberRequest;
import com.db.dbworld.app.tally.entity.*;
import com.db.dbworld.app.tally.mapper.TallyMapper;
import com.db.dbworld.app.tally.repository.*;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Stream;

/**
 * The roster: adding people, changing who pays for whom, letting people go, and turning a ghost
 * into a real account.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class TallyMemberService {

    private final TallyAccessService access;
    private final TallyBalanceService balances;
    private final TallyGroupMemberRepository members;
    private final TallyExpensePayerRepository payers;
    private final TallyExpenseShareRepository shares;
    private final TallyLedgerEntryRepository ledger;
    private final TallySettlementRepository settlements;
    private final TallyMapper mapper;
    private final UserRepository users;

    /* ============================== adding ============================== */

    /**
     * Adds somebody to the group — a db-world account, or a ghost with just a name.
     *
     * <p><b>Re-adding a real user who previously left is an UPDATE, never an INSERT.</b> The
     * unique key {@code (group_id, user_id)} survives their departure, so a second row would
     * fail anyway — but the reason to want the update is stronger than the constraint. A new
     * row would carry a new member id, and every share, ledger entry and settlement already
     * written against the old one would keep pointing at a member who is no longer them. Their
     * history would fork, and their balance would be split across two people who are one.
     */
    @Transactional
    public TallyMemberDto add(Long userId, String groupId, AddMemberRequest request) {
        access.requireOpenGroup(userId, groupId);

        return view(groupId, request.userId() == null
                ? addGhost(groupId, request)
                : addRealUser(groupId, request));
    }

    private TallyGroupMemberEntity addRealUser(String groupId, AddMemberRequest request) {
        UserEntity user = users.findById(request.userId())
                .filter(u -> u.getDeletedAt() == null)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "User not found"));

        var existing = members.findByGroupIdAndUserId(groupId, request.userId());
        if (existing.isPresent()) {
            TallyGroupMemberEntity row = existing.get();
            if (row.isActive()) {
                throw new DbWorldException(HttpStatus.CONFLICT,
                        row.getDisplayName() + " is already in this group");
            }
            // The rejoin. Same row, same id, so their whole history comes back with them.
            row.setStatus(TallyMemberStatus.ACTIVE);
            if (request.displayName() != null && !request.displayName().isBlank()) {
                row.setDisplayName(request.displayName().trim());
            }
            log.debug("Reactivated member {} in tally group {}", row.getId(), groupId);
            return row;
        }

        TallyGroupMemberEntity row = new TallyGroupMemberEntity();
        row.setGroupId(groupId);
        row.setUserId(user.getUserId());
        row.setDisplayName(firstNonBlank(request.displayName(), TallyGroupService.fullNameOf(user), user.getEmail()));
        row.setEmail(user.getEmail());
        return members.save(row);
    }

    private TallyGroupMemberEntity addGhost(String groupId, AddMemberRequest request) {
        if (request.displayName() == null || request.displayName().isBlank()) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST,
                    "Somebody without an account still needs a name");
        }
        TallyGroupMemberEntity row = new TallyGroupMemberEntity();
        row.setGroupId(groupId);
        row.setDisplayName(request.displayName().trim());
        row.setEmail(blankToNull(request.email()));
        return members.save(row);
    }

    /* ============================== updating ============================== */

    /** Renames a member, changes their role, or changes who settles their shares. */
    @Transactional
    public TallyMemberDto update(Long userId, String groupId, String memberId,
                                 UpdateMemberRequest request) {
        access.requireOpenGroup(userId, groupId);
        TallyGroupMemberEntity member = require(groupId, memberId);

        if (request.displayName() != null && !request.displayName().isBlank()) {
            member.setDisplayName(request.displayName().trim());
        }
        if (request.role() != null && request.role() != member.getRole()) {
            access.requireOwner(userId, groupId);
            if (member.getRole() == TallyMemberRole.OWNER) {
                requireAnotherOwnerRemains(groupId, memberId);
            }
            member.setRole(request.role());
        }

        if (request.clearDelegation()) {
            member.setPaidForByMemberId(null);
        } else if (request.paidForByMemberId() != null && !request.paidForByMemberId().isBlank()) {
            member.setPaidForByMemberId(validDelegation(groupId, member, request.paidForByMemberId()));
        }
        return view(groupId, member);
    }

    /**
     * Checks a proposed delegation, and returns it if it holds.
     *
     * <p>Every rule here is enforced <b>now</b>, when the delegation is set, rather than later
     * when an expense uses it. That is the whole design: two cheap queries keep the graph a
     * depth-1 forest permanently, so expense-writing never has to walk a chain or detect a
     * cycle. Deferring the check would surface it at the worst possible moment — as an
     * unrelated third party's expense refusing to save, for a delegation they did not set and
     * cannot see.
     */
    private String validDelegation(String groupId, TallyGroupMemberEntity member, String targetId) {
        if (targetId.equals(member.getId())) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Somebody cannot pay for themselves");
        }

        TallyGroupMemberEntity target = members.findByIdAndGroupId(targetId, groupId)
                .filter(TallyGroupMemberEntity::isActive)
                // Plain id columns mean Hibernate emits no foreign key, so without this check
                // nothing at all prevents liability being pointed at another group entirely.
                .orElseThrow(() -> new DbWorldException(HttpStatus.BAD_REQUEST,
                        "That person is not in this group"));

        if (target.getPaidForByMemberId() != null) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST,
                    "%s already has somebody paying for them, so they cannot pay for anyone else"
                            .formatted(target.getDisplayName()));
        }
        List<TallyGroupMemberEntity> dependants =
                members.findByGroupIdAndPaidForByMemberId(groupId, member.getId());
        if (!dependants.isEmpty()) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST,
                    "%s already pays for %s, so somebody else cannot pay for them"
                            .formatted(member.getDisplayName(), dependants.getFirst().getDisplayName()));
        }
        return targetId;
    }

    /* ============================== removing ============================== */

    /**
     * Takes somebody off the roster.
     *
     * <p><b>Refused unless their balance is exactly zero.</b> This is the most important rule in
     * the module. Letting somebody go while they are owed ₹800, or owe it, does not move that
     * money anywhere — it just stops anyone being able to see it or settle it. The check runs in
     * the same transaction as the removal, so it cannot be raced by an expense landing
     * alongside it.
     *
     * <p>Never a DELETE. No foreign keys exist, so deleting the row would orphan every share,
     * ledger entry and settlement naming them, and their name would stop rendering on the
     * history they are part of. The row stays and its status changes.
     *
     * <p>Anyone may leave of their own accord; removing somebody else takes the owner role.
     */
    @Transactional
    public TallyMemberDto remove(Long userId, String groupId, String memberId) {
        access.requireOpenGroup(userId, groupId);
        TallyGroupMemberEntity member = require(groupId, memberId);
        TallyGroupMemberEntity me = access.requireMembership(userId, groupId);

        if (!me.getId().equals(memberId)) {
            access.requireOwner(userId, groupId);
        }
        if (!member.isActive()) {
            throw new DbWorldException(HttpStatus.CONFLICT, "They have already left this group");
        }
        if (member.getRole() == TallyMemberRole.OWNER) {
            requireAnotherOwnerRemains(groupId, memberId);
        }

        BigDecimal net = balances.netOf(groupId, memberId);
        if (net.signum() != 0) {
            throw new DbWorldException(HttpStatus.CONFLICT, net.signum() > 0
                    ? "%s is still owed %s. Settle up before they leave."
                            .formatted(member.getDisplayName(), net.toPlainString())
                    : "%s still owes %s. Settle up before they leave."
                            .formatted(member.getDisplayName(), net.abs().toPlainString()));
        }

        // Anyone who was relying on them to pay now pays for themselves. Left in place, the
        // dangling delegation would silently reappear in the next expense's snapshot.
        int cleared = members.clearInboundDelegations(groupId, memberId);
        if (cleared > 0) {
            log.debug("Cleared {} delegations pointing at departing member {}", cleared, memberId);
        }

        // Re-read before touching anything. That bulk update is @Modifying(clearAutomatically),
        // so it detached every entity loaded above -- including `member`. Setting the status on
        // the stale copy writes to an object JPA is no longer tracking: no UPDATE is emitted,
        // nothing fails, and the member simply stays in the group.
        TallyGroupMemberEntity departing = require(groupId, memberId);

        // Their own outbound delegation is deliberately kept: if they rejoin, the arrangement
        // they had is still the one they meant. It is cleared for them if that person leaves.
        departing.setStatus(TallyMemberStatus.LEFT);
        return view(groupId, departing);
    }

    /* ============================== ghost claim ============================== */

    /**
     * Takes over a ghost as yourself, folding its whole history into your own membership.
     *
     * <p>This is a <b>merge, not an update</b>. Setting {@code userId} on the ghost row is the
     * obvious implementation and it fails: the caller is already in the group, so the group
     * already holds a row with their user id, and {@code uk_tally_group_member_group_user}
     * refuses the second. Both rows are the same person and have to become one.
     *
     * <p>So every column in the module that names a member id is repointed at the survivor —
     * all eight of them, enumerated in {@link TallyLedgerEntryRepository}, including the
     * self-referencing {@code paid_for_by_member_id} that a merge written from memory always
     * forgets. Then the ghost is tombstoned, holding no references and appearing nowhere.
     *
     * <p>Two of those columns sit under unique keys, so a merge can collide — see
     * {@link #requireNoMergeCollision}.
     *
     * <p>Repointing the ledger can leave entries whose two ends are now the same member, from a
     * debt between the ghost and the claimer. Those are left alone: a self-edge contributes the
     * same amount to a member's credits and debits, so it nets to exactly zero, and deleting it
     * would break the append-only rule to no effect.
     *
     * <h2>Who may do this</h2>
     * Any active member may claim any ghost in their group. That is a real trust assumption,
     * because claiming absorbs the ghost's balance along with its history — so it is a
     * meaningful act, not a cosmetic one. It is acceptable here because a group is a handful of
     * people who already trust each other with a shared ledger, and because the alternative,
     * letting a non-member claim, would turn this into an unguarded door into any group. When an
     * invite flow exists, that is the right place to gate this properly.
     */
    @Transactional
    public TallyMemberDto claim(Long userId, String groupId, String ghostId) {
        access.requireOpenGroup(userId, groupId);
        TallyGroupMemberEntity survivor = access.requireMembership(userId, groupId);
        TallyGroupMemberEntity ghost = require(groupId, ghostId);

        if (!ghost.isGhost()) {
            throw new DbWorldException(HttpStatus.CONFLICT,
                    "%s already belongs to an account".formatted(ghost.getDisplayName()));
        }
        if (!ghost.isActive()) {
            throw new DbWorldException(HttpStatus.CONFLICT, "That person has left this group");
        }
        requireNoMergeCollision(survivor, ghost);

        payers.repointPayer(survivor.getId(), ghostId);              // 1
        shares.repointBeneficiary(survivor.getId(), ghostId);        // 2
        shares.repointOwedBy(survivor.getId(), ghostId);             // 3
        ledger.repointFrom(survivor.getId(), ghostId);               // 4
        ledger.repointTo(survivor.getId(), ghostId);                 // 5
        settlements.repointFrom(survivor.getId(), ghostId);          // 6
        settlements.repointTo(survivor.getId(), ghostId);            // 7
        members.repointDelegations(groupId, survivor.getId(), ghostId);  // 8

        // Re-read: the bulk updates above cleared the persistence context.
        TallyGroupMemberEntity tombstone = require(groupId, ghostId);
        tombstone.setStatus(TallyMemberStatus.LEFT);
        tombstone.setPaidForByMemberId(null);

        log.info("Claimed ghost {} into member {} in tally group {}", ghostId, survivor.getId(), groupId);
        return view(groupId, require(groupId, survivor.getId()));
    }

    /**
     * Refuses a claim that two unique keys would reject halfway through.
     *
     * <p>{@code uk_tally_expense_payer_expense_member} and
     * {@code uk_tally_expense_share_expense_beneficiary} both allow a member to appear once per
     * expense. If the ghost and the claimer are listed on the <em>same</em> expense, repointing
     * makes that one member twice and the INSERT-less UPDATE hits the key.
     *
     * <p>Refused rather than merged, and deliberately. Merging would mean summing two amounts
     * and then picking one of two possibly different {@code owed_by} values — that is guessing
     * about somebody's money. The situation only arises because an expense recorded the same
     * person twice under two identities, which is a mistake with an explicit fix: correct that
     * expense, then claim. A claim is a rare one-time identity repair and it should not quietly
     * rewrite a ledger on the way through.
     */
    private void requireNoMergeCollision(TallyGroupMemberEntity survivor, TallyGroupMemberEntity ghost) {
        long clashingPayments = payers.countMergeCollisions(survivor.getId(), ghost.getId());
        long clashingShares = shares.countMergeCollisions(survivor.getId(), ghost.getId());
        if (clashingPayments + clashingShares > 0) {
            throw new DbWorldException(HttpStatus.CONFLICT,
                    ("%s and %s are both listed on the same expense, so they cannot be merged. "
                   + "Correct that expense first, then claim.")
                            .formatted(ghost.getDisplayName(), survivor.getDisplayName()));
        }
    }

    /* ============================== shared ============================== */

    /**
     * The member as the API returns them, balance included.
     *
     * <p>The balance is read back rather than assumed even where it is known — a member who has
     * just been removed is necessarily at zero, for instance — so that one code path produces
     * every member view and there is no second, hand-set version of this number to drift.
     */
    private TallyMemberDto view(String groupId, TallyGroupMemberEntity member) {
        return mapper.toMemberDto(member, balances.netOf(groupId, member.getId()));
    }

    private TallyGroupMemberEntity require(String groupId, String memberId) {
        return members.findByIdAndGroupId(memberId, groupId)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "Member not found"));
    }

    /**
     * Stops the last owner being demoted or removed.
     *
     * <p>Without this a group can reach a state where nobody can archive it, remove anyone, or
     * void a mistaken expense — and since promoting an owner is itself an owner action, there
     * is no way back.
     */
    private void requireAnotherOwnerRemains(String groupId, String memberId) {
        boolean anotherOwner = members.findByGroupIdAndStatus(groupId, TallyMemberStatus.ACTIVE).stream()
                .anyMatch(m -> m.getRole() == TallyMemberRole.OWNER && !m.getId().equals(memberId));
        if (!anotherOwner) {
            throw new DbWorldException(HttpStatus.CONFLICT,
                    "A group needs an owner. Make somebody else an owner first.");
        }
    }

    private static String firstNonBlank(String... candidates) {
        return Stream.of(candidates)
                .filter(s -> s != null && !s.isBlank())
                .map(String::trim)
                .findFirst()
                .orElseThrow(() -> new DbWorldException(HttpStatus.BAD_REQUEST, "A member needs a name"));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
