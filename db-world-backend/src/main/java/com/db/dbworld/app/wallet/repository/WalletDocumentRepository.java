package com.db.dbworld.app.wallet.repository;

import com.db.dbworld.app.wallet.entity.WalletDocumentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface WalletDocumentRepository extends JpaRepository<WalletDocumentEntity, String> {

    List<WalletDocumentEntity> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<WalletDocumentEntity> findByUserIdAndDocumentTypeIdOrderByCreatedAtDesc(Long userId, String documentTypeId);
    Optional<WalletDocumentEntity> findByIdAndUserId(String id, Long userId);

    long countByDocumentTypeId(String documentTypeId);

    @Query("select coalesce(sum(d.fileSize), 0) from WalletDocumentEntity d")
    long totalStorageBytes();

    // rows of [documentTypeId, count] for the admin monitor breakdown
    @Query("select d.documentTypeId, count(d) from WalletDocumentEntity d group by d.documentTypeId")
    List<Object[]> countGroupedByType();
}
