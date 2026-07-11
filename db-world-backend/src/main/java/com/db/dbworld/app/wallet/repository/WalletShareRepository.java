package com.db.dbworld.app.wallet.repository;

import com.db.dbworld.app.wallet.entity.WalletShareEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface WalletShareRepository extends JpaRepository<WalletShareEntity, String> {
    Optional<WalletShareEntity> findByTokenHash(String tokenHash);
    List<WalletShareEntity> findByDocumentIdAndRevokedFalse(String documentId);
    long countByRevokedFalseAndExpiresAtAfter(Instant now);

    /** Document ids owned by this user that currently have at least one live (non-revoked, non-expired) share. */
    @Query("select distinct s.documentId from WalletShareEntity s " +
           "where s.createdByUserId = :userId and s.revoked = false and s.expiresAt > :now")
    List<String> findActiveDocumentIdsByUser(@Param("userId") Long userId, @Param("now") Instant now);

    @Modifying
    @Transactional
    void deleteByDocumentId(String documentId);

    @Modifying
    @Transactional
    @Query("update WalletShareEntity s set s.accessCount = s.accessCount + 1 " +
           "where s.id = :id and (s.maxAccessCount is null or s.accessCount < s.maxAccessCount)")
    int tryConsumeAccess(@Param("id") String id);
}
