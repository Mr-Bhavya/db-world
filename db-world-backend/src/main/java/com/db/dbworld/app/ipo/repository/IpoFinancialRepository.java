package com.db.dbworld.app.ipo.repository;

import com.db.dbworld.app.ipo.entity.IpoFinancialEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface IpoFinancialRepository extends JpaRepository<IpoFinancialEntity, String> {
    /** Chronological order by the period's actual end date — NOT a string sort on {@code fiscalYear}. */
    List<IpoFinancialEntity> findByIpoIdOrderByPeriodEndAsc(String ipoId);

    /** Looked up by ingest's financials UPSERT — one row per (ipoId, fiscalYear) is the natural key. */
    Optional<IpoFinancialEntity> findByIpoIdAndFiscalYear(String ipoId, String fiscalYear);

    /**
     * Ids of the loser's financials rows that the survivor ALREADY has, ahead of a duplicate merge.
     * Repointing them blindly would leave two rows for the same fiscal year on one IPO, which the detail
     * chart would render as a doubled series.
     *
     * <p>A SELECT of ids that the caller then deletes by primary key, NOT a bulk
     * {@code delete ... where exists (select ... from <same table>)}. MySQL rejects that shape
     * outright (error 1093, "you can't specify target table for delete in FROM clause") while H2 —
     * which the tests run on — accepts it happily, so the bulk form would have passed every test
     * here and failed the first time an admin pressed Merge in production.
     */
    @Query("""
            select f.id from IpoFinancialEntity f
            where f.ipoId = :loserId
              and exists (select 1 from IpoFinancialEntity s
                          where s.ipoId = :survivorId and s.fiscalYear = f.fiscalYear)
            """)
    List<String> findCollidingIdsForMerge(@Param("survivorId") String survivorId, @Param("loserId") String loserId);

    /** Moves the loser's surviving financials onto the survivor. Run after the colliding rows are gone. */
    @Modifying
    @Query("update IpoFinancialEntity f set f.ipoId = :survivorId where f.ipoId = :loserId")
    int repointToSurvivor(@Param("survivorId") String survivorId, @Param("loserId") String loserId);
}
