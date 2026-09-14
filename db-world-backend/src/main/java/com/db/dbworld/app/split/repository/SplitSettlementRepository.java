package com.db.dbworld.app.split.repository;

import com.db.dbworld.app.split.entity.SplitSettlementEntity;
import com.db.dbworld.app.split.entity.SplitSettlementStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SplitSettlementRepository extends JpaRepository<SplitSettlementEntity, String> {

    Optional<SplitSettlementEntity> findByIdAndGroupId(String id, String groupId);

    /** Idempotent replay; the reason a double-tap does not drive the balance the wrong way. */
    Optional<SplitSettlementEntity> findByGroupIdAndIdempotencyKey(String groupId, String idempotencyKey);

    List<SplitSettlementEntity> findByGroupIdAndStatusOrderBySettledAtDesc(String groupId,
                                                                          SplitSettlementStatus status);

    /** What each member has paid out in settlements. */
    @Query("""
            select s.fromMemberId as memberId, sum(s.amount) as total
              from SplitSettlementEntity s
             where s.groupId = :groupId
               and s.status = com.db.dbworld.app.split.entity.SplitSettlementStatus.ACTIVE
             group by s.fromMemberId
            """)
    List<SplitLedgerEntryRepository.MemberTotal> sumPaidOutByGroup(@Param("groupId") String groupId);

    /** What each member has received. */
    @Query("""
            select s.toMemberId as memberId, sum(s.amount) as total
              from SplitSettlementEntity s
             where s.groupId = :groupId
               and s.status = com.db.dbworld.app.split.entity.SplitSettlementStatus.ACTIVE
             group by s.toMemberId
            """)
    List<SplitLedgerEntryRepository.MemberTotal> sumReceivedByGroup(@Param("groupId") String groupId);

    /** Two of the eight member-id references a ghost claim repoints; the list is in
     *  {@link SplitLedgerEntryRepository}. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update SplitSettlementEntity s set s.fromMemberId = :survivorId where s.fromMemberId = :loserId")
    int repointFrom(@Param("survivorId") String survivorId, @Param("loserId") String loserId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update SplitSettlementEntity s set s.toMemberId = :survivorId where s.toMemberId = :loserId")
    int repointTo(@Param("survivorId") String survivorId, @Param("loserId") String loserId);
}
