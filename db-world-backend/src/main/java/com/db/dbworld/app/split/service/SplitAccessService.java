package com.db.dbworld.app.split.service;

import com.db.dbworld.app.split.entity.SplitGroupEntity;
import com.db.dbworld.app.split.entity.SplitGroupMemberEntity;
import com.db.dbworld.app.split.entity.SplitMemberRole;
import com.db.dbworld.app.split.entity.SplitMemberStatus;
import com.db.dbworld.app.split.repository.SplitGroupMemberRepository;
import com.db.dbworld.app.split.repository.SplitGroupRepository;
import com.db.dbworld.core.exception.DbWorldException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The single place that decides whether a caller may see or change a group.
 *
 * <p>db-split is the first domain object in db-world shared between users. Every other module
 * scopes ownership with {@code findByIdAndUserId} — one row, one owner — which cannot express
 * "five people can see this, two of them can archive it". So there is no membership primitive
 * to reuse and this class establishes one. Every service method in the module starts here;
 * none of them query {@code split_group} directly.
 *
 * <h2>404, never 403</h2>
 * A non-member gets {@code Group not found}, the same response they would get for an id that
 * does not exist. 403 would confirm the group is real, which is an existence leak — you could
 * enumerate ids and learn who has a group with whom. This matches wallet's behaviour for
 * documents. It is applied to <em>mutations as well as reads</em>: a write that returns 403
 * leaks exactly as much as a read that does.
 *
 * <h2>Archived is checked on write, not on read</h2>
 * {@link #requireOpenGroup} exists separately from {@link #requireVisibleGroup} because an
 * archived group must stay readable — that is the whole point of archiving instead of deleting.
 * If the check lived on the read path instead, an expense could still be posted into an
 * archived group and land somewhere nobody will ever look at it again.
 */
@Service
@RequiredArgsConstructor
public class SplitAccessService {

    private final SplitGroupRepository groups;
    private final SplitGroupMemberRepository members;

    /** A group the caller belongs to, readable whether or not it is archived. */
    @Transactional(readOnly = true)
    public SplitGroupEntity requireVisibleGroup(Long userId, String groupId) {
        requireMembership(userId, groupId);
        return groups.findById(groupId).orElseThrow(SplitAccessService::notFound);
    }

    /** A group the caller belongs to that is still open for writes. */
    @Transactional(readOnly = true)
    public SplitGroupEntity requireOpenGroup(Long userId, String groupId) {
        requireMembership(userId, groupId);
        return groups.findOpenById(groupId).orElseThrow(() -> new DbWorldException(
                HttpStatus.CONFLICT, "This group is archived and cannot be changed"));
    }

    /**
     * The caller's own membership row.
     *
     * <p>Only an ACTIVE membership counts. Somebody who left keeps their history — their name
     * still renders on old expenses — but loses access, which is a different question from
     * whether their rows survive.
     */
    @Transactional(readOnly = true)
    public SplitGroupMemberEntity requireMembership(Long userId, String groupId) {
        return members.findByGroupIdAndUserId(groupId, userId)
                .filter(m -> m.getStatus() == SplitMemberStatus.ACTIVE)
                .orElseThrow(SplitAccessService::notFound);
    }

    /**
     * Membership plus the owner role, for the three actions that affect other people: voiding
     * somebody else's expense, removing a member, and archiving the group.
     *
     * <p>403 here rather than 404, and deliberately so: the caller has already proved they are
     * a member, so the group's existence is not a secret from them. There is nothing left to
     * leak, and "you are not an owner" is the useful answer.
     */
    @Transactional(readOnly = true)
    public SplitGroupMemberEntity requireOwner(Long userId, String groupId) {
        SplitGroupMemberEntity me = requireMembership(userId, groupId);
        if (me.getRole() != SplitMemberRole.OWNER) {
            throw new DbWorldException(HttpStatus.FORBIDDEN,
                    "Only a group owner can do that");
        }
        return me;
    }

    private static DbWorldException notFound() {
        return new DbWorldException(HttpStatus.NOT_FOUND, "Group not found");
    }
}
