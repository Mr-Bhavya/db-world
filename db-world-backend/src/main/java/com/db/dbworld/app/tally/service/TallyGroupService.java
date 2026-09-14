package com.db.dbworld.app.tally.service;

import com.db.dbworld.app.tally.dto.TallyRequests.CreateGroup;
import com.db.dbworld.app.tally.dto.TallyRequests.UpdateGroup;
import com.db.dbworld.app.tally.dto.TallyViews.GroupDetail;
import com.db.dbworld.app.tally.dto.TallyViews.GroupSummary;
import com.db.dbworld.app.tally.dto.TallyViews.Member;
import com.db.dbworld.app.tally.entity.*;
import com.db.dbworld.app.tally.repository.TallyGroupMemberRepository;
import com.db.dbworld.app.tally.repository.TallyGroupRepository;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Creating, listing, opening and closing groups. */
@Log4j2
@Service
@RequiredArgsConstructor
public class TallyGroupService {

    private final TallyAccessService access;
    private final TallyBalanceService balances;
    private final TallyGroupRepository groups;
    private final TallyGroupMemberRepository members;
    private final UserRepository users;

    /* ============================== create ============================== */

    /**
     * Creates a group with its creator already in it, as the owner.
     *
     * <p>The membership row is not a convenience — it is the only thing that grants access.
     * {@code createdByUserId} on the group records history and confers nothing, so a group
     * written without this row would be invisible to the person who just made it.
     */
    @Transactional
    public GroupDetail create(Long userId, CreateGroup request) {
        TallyGroupEntity group = new TallyGroupEntity();
        group.setName(request.name().trim());
        group.setCategory(blankToNull(request.category()));
        group.setCreatedByUserId(userId);
        groups.save(group);

        TallyGroupMemberEntity me = new TallyGroupMemberEntity();
        me.setGroupId(group.getId());
        me.setUserId(userId);
        me.setDisplayName(displayNameOf(userId));
        me.setRole(TallyMemberRole.OWNER);
        members.save(me);

        log.debug("Created tally group {} for user {}", group.getId(), userId);
        return detailOf(group, List.of(me), Map.of());
    }

    /* ============================== read ============================== */

    /**
     * Every group the caller is in, with their own position in each.
     *
     * <p>Resolves membership first and loads the groups by id, rather than joining from group
     * to member. Keeping the two steps apart means the question "may I see this" is answered in
     * one place instead of being smuggled into a join condition that every future read would
     * have to remember to repeat.
     */
    @Transactional(readOnly = true)
    public List<GroupSummary> listMine(Long userId) {
        List<TallyGroupMemberEntity> mine = members.findByUserIdAndStatus(userId, TallyMemberStatus.ACTIVE);
        if (mine.isEmpty()) {
            return List.of();
        }
        Map<String, TallyGroupMemberEntity> myRowByGroup = mine.stream()
                .collect(Collectors.toMap(TallyGroupMemberEntity::getGroupId, Function.identity()));

        Map<String, Long> activeCounts = members.countActiveByGroupIds(myRowByGroup.keySet()).stream()
                .collect(Collectors.toMap(c -> c.getGroupId(), c -> c.getTotal()));

        // One balance query per group. A join would collapse them, but somebody is in five
        // groups, not five hundred, and each of these is an index-only read.
        return groups.findByIdIn(myRowByGroup.keySet()).stream()
                .sorted(Comparator.comparing(TallyGroupEntity::getUpdatedAt).reversed())
                .map(g -> new GroupSummary(
                        g.getId(), g.getName(), g.getCategory(), g.getCurrency(), g.isArchived(),
                        activeCounts.getOrDefault(g.getId(), 0L).intValue(),
                        balances.netOf(g.getId(), myRowByGroup.get(g.getId()).getId()),
                        g.getUpdatedAt()))
                .toList();
    }

    /**
     * One group with its full roster.
     *
     * <p>The roster is loaded <b>unfiltered</b>, departed members included. They keep appearing
     * because their names still have to render on the expenses they were part of; an old dinner
     * that reads "paid by (unknown)" is worse than useless. Filtering to active members is the
     * caller's job, and only for the participant pickers.
     */
    @Transactional(readOnly = true)
    public GroupDetail get(Long userId, String groupId) {
        TallyGroupEntity group = access.requireVisibleGroup(userId, groupId);
        return detailOf(group, members.findByGroupId(groupId), balances.balances(groupId));
    }

    /* ============================== update ============================== */

    /**
     * Renames a group, or archives and reopens it.
     *
     * <p>Renaming is open to any member; archiving is not, because it takes the group away from
     * everybody.
     *
     * <h2>Archiving with money still outstanding</h2>
     * Refused by default, with a 409 naming the largest amount, because "archived with ₹4,000
     * outstanding and hidden from everyone" is how a debt quietly stops existing.
     *
     * <p>But not refused outright. A group can genuinely reach a state nobody intends to settle
     * — somebody moved away, the amount stopped mattering, the rest of the group wrote it off —
     * and a rule with no way past it would leave that group on everyone's list forever. So the
     * caller may pass {@code settleOutstandingLater} and archive anyway. The difference that
     * matters is that it cannot happen by accident: somebody had to be told the number and say
     * yes. Archiving is also reversible, which is the other reason this is a speed bump rather
     * than a wall — unlike removing a member, which is not, and where the zero-balance rule is
     * therefore absolute.
     */
    @Transactional
    public GroupDetail update(Long userId, String groupId, UpdateGroup request) {
        TallyGroupEntity group = access.requireVisibleGroup(userId, groupId);

        if (request.name() != null && !request.name().isBlank()) {
            group.setName(request.name().trim());
        }
        if (request.category() != null) {
            group.setCategory(blankToNull(request.category()));
        }

        if (request.archived() != null && request.archived() != group.isArchived()) {
            access.requireOwner(userId, groupId);
            if (request.archived()) {
                archive(group, request.settleOutstandingLater());
            } else {
                group.setArchivedAt(null);
            }
        }
        return detailOf(group, members.findByGroupId(groupId), balances.balances(groupId));
    }

    private void archive(TallyGroupEntity group, boolean acknowledged) {
        if (!acknowledged) {
            Map<String, BigDecimal> outstanding = balances.balances(group.getId());
            if (!outstanding.isEmpty()) {
                BigDecimal largest = outstanding.values().stream()
                        .map(BigDecimal::abs).max(BigDecimal::compareTo).orElse(BigDecimal.ZERO);
                throw new DbWorldException(HttpStatus.CONFLICT,
                        ("This group still has %s outstanding between %d people. Settle up first, "
                       + "or archive anyway if nobody intends to.")
                                .formatted(largest.toPlainString(), outstanding.size()));
            }
        }
        group.setArchivedAt(Instant.now());
    }

    /* ============================== shaping ============================== */

    private GroupDetail detailOf(TallyGroupEntity group, List<TallyGroupMemberEntity> roster,
                                 Map<String, BigDecimal> balanceByMember) {
        List<Member> memberViews = roster.stream()
                // Active first, then by name: a departed member belongs at the bottom of the
                // list, present but out of the way.
                .sorted(Comparator.comparing(TallyGroupMemberEntity::isActive).reversed()
                        .thenComparing(TallyGroupMemberEntity::getDisplayName, String.CASE_INSENSITIVE_ORDER))
                .map(m -> new Member(m.getId(), m.getUserId(), m.getDisplayName(), m.getEmail(),
                        m.getRole(), m.getStatus(), m.isGhost(), m.getPaidForByMemberId(),
                        balanceByMember.getOrDefault(m.getId(), BigDecimal.ZERO)))
                .toList();

        return new GroupDetail(group.getId(), group.getName(), group.getCategory(),
                group.getCurrency(), group.isArchived(), group.getCreatedAt(), memberViews);
    }

    /**
     * The creator's name for their own membership row, seeded from their account.
     *
     * <p>Only a seed. The row keeps its own copy so it can be edited per group, and so a ghost
     * and a real member are the same kind of thing everywhere else in the module.
     */
    private String displayNameOf(Long userId) {
        return users.findById(userId)
                .map(u -> java.util.stream.Stream.of(u.getFirstName(), u.getLastName())
                        .filter(s -> s != null && !s.isBlank())
                        .collect(Collectors.joining(" ")))
                .filter(s -> !s.isBlank())
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
