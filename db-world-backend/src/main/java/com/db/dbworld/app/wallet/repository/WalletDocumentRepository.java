package com.db.dbworld.app.wallet.repository;

import com.db.dbworld.app.wallet.entity.WalletDocumentEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
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

    /* ── Home dashboard ──────────────────────────────────────────────────────────────────────
       Counts only: the hub tile needs figures, not the documents themselves, and a wallet row
       carries an encrypted document number that has no business being loaded to render a badge. */

    long countByUserId(Long userId);

    /** Documents already past their expiry date. */
    long countByUserIdAndExpiryDateBefore(Long userId, LocalDate date);

    /** Documents expiring inside the reminder window (inclusive of both ends). */
    long countByUserIdAndExpiryDateBetween(Long userId, LocalDate from, LocalDate to);

    /**
     * The soonest-expiring document from {@code date} onward, so the tile can name it. Already
     * expired documents are excluded — they are covered by the "expired" count, and surfacing the
     * oldest lapsed passport as "next up" would bury the licence that expires next week.
     */
    List<WalletDocumentEntity> findByUserIdAndExpiryDateGreaterThanEqualOrderByExpiryDateAsc(
            Long userId, LocalDate date, Pageable pageable);
}
