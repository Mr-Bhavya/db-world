package com.db.dbworld.app.ipo.repository;

import com.db.dbworld.app.ipo.entity.IpoFinancialEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IpoFinancialRepository extends JpaRepository<IpoFinancialEntity, String> {
    List<IpoFinancialEntity> findByIpoIdOrderByFiscalYearAsc(String ipoId);
}
