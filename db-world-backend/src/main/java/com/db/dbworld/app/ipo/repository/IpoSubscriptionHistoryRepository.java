package com.db.dbworld.app.ipo.repository;

import com.db.dbworld.app.ipo.entity.IpoSubscriptionHistoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface IpoSubscriptionHistoryRepository extends JpaRepository<IpoSubscriptionHistoryEntity, String> {
    Optional<IpoSubscriptionHistoryEntity> findTopByIpoIdOrderByCapturedAtDesc(String ipoId);
    List<IpoSubscriptionHistoryEntity> findByIpoIdOrderByCapturedAtAsc(String ipoId);

    /**
     * Ids of the loser's subscription history rows that the survivor ALREADY has, ahead of a duplicate merge.
     * Repointing them blindly would leave two rows for the same captured instant on one IPO, which the detail
     * chart would render as a doubled series.
     *
     * <p>A SELECT of ids that the caller then deletes by primary key, NOT a bulk
     * {@code delete ... where exists (select ... from <same table>)}. MySQL rejects that shape
     * outright (error 1093, "you can't specify target table for delete in FROM clause") while H2 —
     * which the tests run on — accepts it happily, so the bulk form would have passed every test
     * here and failed the first time an admin pressed Merge in production.
     */
    @Query("""
            select h.id from IpoSubscriptionHistoryEntity h
            where h.ipoId = :loserId
              and exists (select 1 from IpoSubscriptionHistoryEntity s
                          where s.ipoId = :survivorId and s.capturedAt = h.capturedAt)
            """)
    List<String> findCollidingIdsForMerge(@Param("survivorId") String survivorId, @Param("loserId") String loserId);

    /** Moves the loser's surviving subscription history onto the survivor. Run after the colliding rows are gone. */
    @Modifying
    @Query("update IpoSubscriptionHistoryEntity h set h.ipoId = :survivorId where h.ipoId = :loserId")
    int repointToSurvivor(@Param("survivorId") String survivorId, @Param("loserId") String loserId);
}
