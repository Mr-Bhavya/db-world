package com.db.dbworld.app.tally.repository;

import com.db.dbworld.app.tally.entity.TallySettlementEntity;
import com.db.dbworld.app.tally.entity.TallySettlementStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TallySettlementRepository extends JpaRepository<TallySettlementEntity, String> {

    Optional<TallySettlementEntity> findByIdAndGroupId(String id, String groupId);

    /** Idempotent replay; the reason a double-tap does not drive the balance the wrong way. */
    Optional<TallySettlementEntity> findByGroupIdAndIdempotencyKey(String groupId, String idempotencyKey);

    List<TallySettlementEntity> findByGroupIdAndStatusOrderBySettledAtDesc(String groupId,
                                                                          TallySettlementStatus status);

    /** What each member has paid out in settlements. */
    /**
     * What was actually handed over inside a period.
     *
     * <p>Reported beside the group's spending and never added to it: settling up moves money
     * that was already counted when the expense was recorded, so adding the two would book
     * every shared bill twice.
     *
     * <p>Bounds are instants because {@code settled_at} is one — the caller converts the
     * report's dates at the zone the rest of the report uses. Half-open ({@code >= from},
     * {@code < toExclusive}) so the last day is whole without depending on how precisely the
     * timestamp was stored.
     */
    @Query("""
            select coalesce(sum(s.amount), 0)
              from TallySettlementEntity s
             where s.groupId = :groupId
               and s.status = com.db.dbworld.app.tally.entity.TallySettlementStatus.ACTIVE
               and s.settledAt >= :from
               and s.settledAt < :toExclusive
            """)
    BigDecimal sumSettledBetween(@Param("groupId") String groupId,
                                 @Param("from") Instant from,
                                 @Param("toExclusive") Instant toExclusive);

    @Query("""
            select s.fromMemberId as memberId, sum(s.amount) as total
              from TallySettlementEntity s
             where s.groupId = :groupId
               and s.status = com.db.dbworld.app.tally.entity.TallySettlementStatus.ACTIVE
             group by s.fromMemberId
            """)
    List<TallyLedgerEntryRepository.MemberTotal> sumPaidOutByGroup(@Param("groupId") String groupId);

    /** What each member has received. */
    @Query("""
            select s.toMemberId as memberId, sum(s.amount) as total
              from TallySettlementEntity s
             where s.groupId = :groupId
               and s.status = com.db.dbworld.app.tally.entity.TallySettlementStatus.ACTIVE
             group by s.toMemberId
            """)
    List<TallyLedgerEntryRepository.MemberTotal> sumReceivedByGroup(@Param("groupId") String groupId);

    /** Two of the eight member-id references a ghost claim repoints; the list is in
     *  {@link TallyLedgerEntryRepository}. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update TallySettlementEntity s set s.fromMemberId = :survivorId where s.fromMemberId = :loserId")
    int repointFrom(@Param("survivorId") String survivorId, @Param("loserId") String loserId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update TallySettlementEntity s set s.toMemberId = :survivorId where s.toMemberId = :loserId")
    int repointTo(@Param("survivorId") String survivorId, @Param("loserId") String loserId);
}
