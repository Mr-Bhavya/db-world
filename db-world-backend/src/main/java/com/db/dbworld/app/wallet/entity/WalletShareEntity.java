package com.db.dbworld.app.wallet.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "wallet_share", schema = "db_world",
        uniqueConstraints = @UniqueConstraint(name = "uk_wallet_share_token", columnNames = "token_hash"),
        indexes = @Index(name = "idx_wallet_share_doc", columnList = "document_id"))
@Getter @Setter @NoArgsConstructor
public class WalletShareEntity {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(name = "document_id", nullable = false, length = 36) private String documentId;
    @Column(name = "created_by_user_id", nullable = false) private Long createdByUserId;
    @Column(name = "token_hash", nullable = false, length = 64) private String tokenHash;

    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(name = "max_access_count") private Integer maxAccessCount;
    @Column(name = "access_count", nullable = false) private int accessCount;
    @Column(nullable = false) private boolean revoked;

    @CreationTimestamp @Column(nullable = false, updatable = false) private Instant createdAt;
}
