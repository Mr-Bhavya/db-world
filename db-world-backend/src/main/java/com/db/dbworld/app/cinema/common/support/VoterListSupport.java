package com.db.dbworld.app.cinema.common.support;

import com.db.dbworld.app.cinema.common.dto.VoterSummary;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.repository.UserRepository;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Shared helpers for resolving voter user IDs to {@link VoterSummary} projections
 * so admin views of media-requests and catalog-ingest-requests can show who voted.
 */
public final class VoterListSupport {

    private VoterListSupport() {}

    /** Batch-load users by ID and return a map keyed by userId. Empty input → empty map. */
    public static Map<Long, VoterSummary> loadVoterCache(Collection<Long> userIds, UserRepository userRepo) {
        if (userIds == null || userIds.isEmpty()) return Map.of();
        return userRepo.findAllById(userIds).stream()
                .collect(Collectors.toMap(UserEntity::getUserId, VoterListSupport::toVoterSummary, (a, b) -> a));
    }

    /**
     * Build a sorted voter list for a single request. Voter IDs missing from the cache
     * are surfaced as "User #ID" so a deleted user doesn't drop a row from the count.
     */
    public static List<VoterSummary> buildVoterList(Set<Long> voterIds, Map<Long, VoterSummary> cache) {
        if (voterIds == null || voterIds.isEmpty()) return List.of();
        return voterIds.stream()
                .map(id -> cache.getOrDefault(id, new VoterSummary(id, "User #" + id, null)))
                .sorted(Comparator.comparing(VoterSummary::name, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();
    }

    private static VoterSummary toVoterSummary(UserEntity u) {
        String first = u.getFirstName();
        String last = u.getLastName();
        String name;
        if ((first == null || first.isBlank()) && (last == null || last.isBlank())) {
            name = u.getEmail() != null ? u.getEmail() : "User #" + u.getUserId();
        } else {
            StringBuilder sb = new StringBuilder();
            if (first != null && !first.isBlank()) sb.append(first.trim());
            if (last != null && !last.isBlank()) {
                if (sb.length() > 0) sb.append(' ');
                sb.append(last.trim());
            }
            name = sb.toString();
        }
        return new VoterSummary(u.getUserId(), name, u.getEmail());
    }
}
