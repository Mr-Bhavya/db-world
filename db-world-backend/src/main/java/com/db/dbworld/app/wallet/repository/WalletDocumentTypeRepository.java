package com.db.dbworld.app.wallet.repository;

import com.db.dbworld.app.wallet.entity.WalletDocumentTypeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WalletDocumentTypeRepository extends JpaRepository<WalletDocumentTypeEntity, String> {
    Optional<WalletDocumentTypeEntity> findByCode(String code);
    List<WalletDocumentTypeEntity> findByActiveTrueOrderBySortOrderAsc();
    List<WalletDocumentTypeEntity> findAllByOrderBySortOrderAsc();
    boolean existsByCode(String code);
}
