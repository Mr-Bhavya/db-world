package com.db.dbworld.app.tally.service;

import com.db.dbworld.app.tally.entity.TallyGroupEntity;
import com.db.dbworld.app.tally.entity.TallyGroupKind;
import com.db.dbworld.app.tally.entity.TallyGroupMemberEntity;
import com.db.dbworld.app.tally.repository.TallyGroupMemberRepository;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * What a ledger is called for the person reading it.
 *
 * <p>A one-to-one ledger has no name of its own: it is "the other person", and who that is depends
 * on who is looking. The stored {@code name} is only the creator's view, so reading it back for the
 * other side would show them their own name.
 */
final class TallyLedgerNames {

    private TallyLedgerNames() {}

    static String forViewer(Long viewerId, TallyGroupEntity group,
                            Collection<TallyGroupMemberEntity> roster) {
        if (group.getKind() != TallyGroupKind.DIRECT) {
            return group.getName();
        }
        return roster.stream()
                .filter(m -> group.getId().equals(m.getGroupId()) && !viewerId.equals(m.getUserId()))
                .sorted(Comparator.comparing(TallyGroupMemberEntity::isActive).reversed())
                .map(TallyGroupMemberEntity::getDisplayName)
                .filter(name -> name != null && !name.isBlank())
                .findFirst()
                .orElse(group.getName());
    }

    /** Batch form: one roster read for all the direct ledgers, none for anything else. */
    static Map<String, String> forViewer(Long viewerId, Collection<TallyGroupEntity> groups,
                                         TallyGroupMemberRepository members) {
        List<String> directIds = groups.stream()
                .filter(g -> g.getKind() == TallyGroupKind.DIRECT)
                .map(TallyGroupEntity::getId)
                .toList();
        List<TallyGroupMemberEntity> rosters = directIds.isEmpty() ? List.of() : members.findByGroupIdIn(directIds);
        Map<String, List<TallyGroupMemberEntity>> rosterByGroup = rosters.stream()
                .collect(Collectors.groupingBy(TallyGroupMemberEntity::getGroupId));

        return groups.stream().collect(Collectors.toMap(
                TallyGroupEntity::getId,
                g -> forViewer(viewerId, g, rosterByGroup.getOrDefault(g.getId(), List.of())),
                (a, b) -> a));
    }

    /** A loan's title for whoever is reading: "Lent to Riya" to one side, "Borrowed from Me" to the other. */
    static String loanTitle(String viewerMemberId, String lenderId, String borrowerId,
                            Map<String, String> nameById) {
        String lender = nameById.getOrDefault(lenderId, "Someone");
        String borrower = nameById.getOrDefault(borrowerId, "someone");
        if (lenderId.equals(viewerMemberId)) return "Lent to " + borrower;
        if (borrowerId.equals(viewerMemberId)) return "Borrowed from " + lender;
        return lender + " lent " + borrower;
    }

    /** "Asha, Ravi & Meera" — the label a one-to-one ledger takes when a third person joins. */
    static String joined(List<String> names, int maxLength) {
        String label = switch (names.size()) {
            case 0 -> "";
            case 1 -> names.getFirst();
            default -> String.join(", ", names.subList(0, names.size() - 1)) + " & " + names.getLast();
        };
        return label.length() <= maxLength ? label : label.substring(0, maxLength - 1).stripTrailing() + "…";
    }
}
