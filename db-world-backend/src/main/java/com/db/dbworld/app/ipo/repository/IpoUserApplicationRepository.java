package com.db.dbworld.app.ipo.repository;

import com.db.dbworld.app.ipo.entity.IpoUserApplicationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface IpoUserApplicationRepository extends JpaRepository<IpoUserApplicationEntity, String> {

    List<IpoUserApplicationEntity> findByUserId(Long userId);

    Optional<IpoUserApplicationEntity> findByUserIdAndIpoId(Long userId, String ipoId);

    @Modifying
    @Transactional
    void deleteByUserIdAndIpoId(Long userId, String ipoId);

    /** How many users tracked the loser row — surfaced in the duplicate report, since this is the
     *  one thing a merge touches that is real user data rather than scraped data. */
    long countByIpoId(String ipoId);

    /**
     * Ids of the loser's application rows for users who ALSO tracked the survivor, ahead of a
     * duplicate merge. {@code (user_id, ipo_id)} is UNIQUE, so repointing those would throw — and
     * the user in question loses nothing, because the row being dropped is a second copy of an
     * application they already hold against the surviving row.
     *
     * <p>A SELECT of ids the caller then deletes by primary key, NOT a bulk
     * {@code delete ... where exists (select ... from <same table>)}: MySQL rejects that shape
     * (error 1093) where H2 — which the tests run on — accepts it, so the bulk form would have
     * passed here and failed in production.
     */
    @Query("""
            select a.id from IpoUserApplicationEntity a
            where a.ipoId = :loserId
              and exists (select 1 from IpoUserApplicationEntity s
                          where s.ipoId = :survivorId and s.userId = a.userId)
            """)
    List<String> findCollidingIdsForMerge(@Param("survivorId") String survivorId, @Param("loserId") String loserId);

    /** Moves the loser's remaining applications onto the survivor, so nobody loses a tracked IPO. */
    @Modifying
    @Query("update IpoUserApplicationEntity a set a.ipoId = :survivorId where a.ipoId = :loserId")
    int repointToSurvivor(@Param("survivorId") String survivorId, @Param("loserId") String loserId);
}
