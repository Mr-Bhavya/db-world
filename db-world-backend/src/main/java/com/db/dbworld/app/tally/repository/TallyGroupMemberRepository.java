package com.db.dbworld.app.tally.repository;

import com.db.dbworld.app.tally.entity.TallyGroupMemberEntity;
import com.db.dbworld.app.tally.entity.TallyMemberStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TallyGroupMemberRepository extends JpaRepository<TallyGroupMemberEntity, String> {

    /* ============================== roster ============================== */

    /**
     * Everyone ever in the group, including those who have left.
     *
     * <p>History must keep rendering a departed member's name — an expense that suddenly reads
     * "paid by (unknown)" is worse than useless. So the roster is loaded unfiltered and the
     * ACTIVE filter is applied only where it belongs: the member list and the participant
     * pickers.
     */
    List<TallyGroupMemberEntity> findByGroupId(String groupId);

    List<TallyGroupMemberEntity> findByGroupIdAndStatus(String groupId, TallyMemberStatus status);

    Optional<TallyGroupMemberEntity> findByIdAndGroupId(String id, String groupId);

    /* ============================== membership ============================== */

    /**
     * The authorization primitive for the whole module, and db-world's first: every other app
     * scopes ownership with {@code findByIdAndUserId}, which cannot express a shared object.
     */
    Optional<TallyGroupMemberEntity> findByGroupIdAndUserId(String groupId, Long userId);

    /** Backs "my groups"; served by {@code idx_tally_group_member_user}. */
    List<TallyGroupMemberEntity> findByUserIdAndStatus(Long userId, TallyMemberStatus status);

    /* ============================== delegation ============================== */

    /** Anyone whose liability currently rolls up to this member. Used to enforce depth 1. */
    List<TallyGroupMemberEntity> findByGroupIdAndPaidForByMemberId(String groupId, String memberId);

    /**
     * Clears every delegation pointing at a member who is being removed, so nobody is left
     * delegating to somebody who is gone.
     *
     * <p>Written as a direct predicate on purpose. The natural-looking
     * {@code where paid_for_by_member_id in (select id from tally_group_member where ...)} is
     * the exact shape MySQL rejects with error 1093 — you cannot read the table you are
     * updating — while H2, which the tests run on, accepts it happily. There is a documented
     * precedent for that trap in this repo; see {@code IpoUserApplicationRepository}.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update TallyGroupMemberEntity m
               set m.paidForByMemberId = null
             where m.groupId = :groupId
               and m.paidForByMemberId = :memberId
            """)
    int clearInboundDelegations(@Param("groupId") String groupId, @Param("memberId") String memberId);

    /**
     * Repoints the self-referencing delegation column during a ghost claim.
     *
     * <p>The one column a merge forgets, because it is the only reference a member row holds to
     * another member row in the same table.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update TallyGroupMemberEntity m
               set m.paidForByMemberId = :survivorId
             where m.groupId = :groupId
               and m.paidForByMemberId = :loserId
            """)
    int repointDelegations(@Param("groupId") String groupId,
                           @Param("survivorId") String survivorId,
                           @Param("loserId") String loserId);
}
