package com.db.dbworld.app.ipo.repository;

import com.db.dbworld.app.ipo.entity.IpoGmpHistoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface IpoGmpHistoryRepository extends JpaRepository<IpoGmpHistoryEntity, String> {
    Optional<IpoGmpHistoryEntity> findTopByIpoIdOrderByCapturedAtDesc(String ipoId);
    List<IpoGmpHistoryEntity> findByIpoIdOrderByCapturedAtAsc(String ipoId);
}
