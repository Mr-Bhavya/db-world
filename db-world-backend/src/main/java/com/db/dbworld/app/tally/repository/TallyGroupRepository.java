package com.db.dbworld.app.tally.repository;

import com.db.dbworld.app.tally.entity.TallyGroupEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TallyGroupRepository extends JpaRepository<TallyGroupEntity, String> {

    /**
     * Loads the groups a membership lookup already resolved.
     *
     * <p>Deliberately not a join from {@code tally_group_member}: membership is resolved first
     * through {@code idx_tally_group_member_user}, and the ids come back here. Keeping the two
     * steps apart means the authorization decision — am I a member — happens in one place
     * rather than being smuggled into the join condition of every read.
     */
    List<TallyGroupEntity> findByIdIn(Collection<String> ids);

    /**
     * A group only if it is still open for writes.
     *
     * <p>Mutating paths use this rather than {@code findById}, because the archived check has to
     * happen on the write and not on the read: check it only when displaying and an expense can
     * still be posted into an archived group, where nobody will ever see it again.
     */
    @Query("select g from TallyGroupEntity g where g.id = :id and g.archivedAt is null")
    Optional<TallyGroupEntity> findOpenById(@Param("id") String id);

    /**
     * Any live one-to-one ledger these two people already share.
     *
     * <p>Used to stop a second one being created. Two parallel running totals with the same
     * person is precisely the money-in-two-places failure this module is built to avoid —
     * you would settle up on one and still owe on the other, with no way to see why.
     *
     * <p>Matched on <b>user id only</b>, so it applies to real accounts. Two ledgers each with
     * a ghost called "Amma" may genuinely be two different people, and guessing from a name
     * would silently merge somebody's debts.
     */
    @Query("""
            select g.id from TallyGroupEntity g
             where g.kind = com.db.dbworld.app.tally.entity.TallyGroupKind.DIRECT
               and g.archivedAt is null
               and exists (select 1 from TallyGroupMemberEntity mine
                            where mine.groupId = g.id and mine.userId = :me)
               and exists (select 1 from TallyGroupMemberEntity theirs
                            where theirs.groupId = g.id and theirs.userId = :them)
            """)
    List<String> findDirectLedgerBetween(@Param("me") Long me, @Param("them") Long them);

    /**
     * Somebody's own spending ledger, if they have started one.
     *
     * <p>There is exactly one per person and it is found rather than created twice, for the
     * same reason a direct ledger is: two places to record your own spending means two monthly
     * totals, both of them wrong.
     *
     * <p>Archived ones are included deliberately. If you archived it and then tap "My spending"
     * again, the right answer is the ledger you already have — with its history — not a second
     * empty one beside it.
     */
    @Query("""
            select g.id from TallyGroupEntity g
             where g.kind = com.db.dbworld.app.tally.entity.TallyGroupKind.PERSONAL
               and g.createdByUserId = :userId
             order by g.createdAt asc
            """)
    List<String> findPersonalLedger(@Param("userId") Long userId);
}
