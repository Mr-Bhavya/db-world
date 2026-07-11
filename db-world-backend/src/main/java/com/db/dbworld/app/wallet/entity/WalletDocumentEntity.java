package com.db.dbworld.app.wallet.entity;

import com.db.dbworld.security.crypto.StringCryptoConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "wallet_document", schema = "db_world",
        indexes = {
            // owner lookups (list a user's documents)
            @Index(name = "idx_wallet_doc_user", columnList = "user_id"),
            // owner + type filter
            @Index(name = "idx_wallet_doc_user_type", columnList = "user_id, document_type_id")
        })
@Getter @Setter @NoArgsConstructor
public class WalletDocumentEntity {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(name = "user_id", nullable = false) private Long userId;
    @Column(name = "document_type_id", nullable = false, length = 36) private String documentTypeId;
    @Column(nullable = false, length = 150) private String label;
    @Column(length = 120) private String holderName;

    @Convert(converter = StringCryptoConverter.class)
    @Lob @Column(columnDefinition = "LONGTEXT")
    private String documentNumber;

    private LocalDate issueDate;
    private LocalDate expiryDate;

    @Convert(converter = StringCryptoConverter.class)
    @Lob @Column(columnDefinition = "LONGTEXT")
    private String notes;

    @Column(nullable = false, length = 255) private String originalFileName;
    @Column(nullable = false, length = 100) private String contentType;
    @Column(nullable = false) private long fileSize;
    @Column(nullable = false, length = 120) private String storedFileName;
    @Column(length = 120) private String thumbnailStoredName;

    @CreationTimestamp @Column(nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp   @Column(nullable = false)                    private Instant updatedAt;
}
