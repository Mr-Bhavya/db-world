package com.db.dbworld.app.ipo.repository;

import com.db.dbworld.app.ipo.entity.IpoFinancialEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface IpoFinancialRepository extends JpaRepository<IpoFinancialEntity, String> {
    /** Chronological order by the period's actual end date — NOT a string sort on {@code fiscalYear}. */
    List<IpoFinancialEntity> findByIpoIdOrderByPeriodEndAsc(String ipoId);

    /** Looked up by ingest's financials UPSERT — one row per (ipoId, fiscalYear) is the natural key. */
    Optional<IpoFinancialEntity> findByIpoIdAndFiscalYear(String ipoId, String fiscalYear);
}
