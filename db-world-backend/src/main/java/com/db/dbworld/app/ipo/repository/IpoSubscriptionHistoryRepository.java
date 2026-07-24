package com.db.dbworld.app.ipo.repository;

import com.db.dbworld.app.ipo.entity.IpoSubscriptionHistoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface IpoSubscriptionHistoryRepository extends JpaRepository<IpoSubscriptionHistoryEntity, String> {
    Optional<IpoSubscriptionHistoryEntity> findTopByIpoIdOrderByCapturedAtDesc(String ipoId);
    List<IpoSubscriptionHistoryEntity> findByIpoIdOrderByCapturedAtAsc(String ipoId);
}
