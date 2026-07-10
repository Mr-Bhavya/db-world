package com.db.dbworld.app.wallet.repository;

import com.db.dbworld.app.wallet.entity.WalletShareEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface WalletShareRepository extends JpaRepository<WalletShareEntity, String> {
    Optional<WalletShareEntity> findByTokenHash(String tokenHash);
    List<WalletShareEntity> findByDocumentIdAndRevokedFalse(String documentId);
    long countByRevokedFalseAndExpiresAtAfter(Instant now);

    @Modifying
    @Transactional
    void deleteByDocumentId(String documentId);
}
