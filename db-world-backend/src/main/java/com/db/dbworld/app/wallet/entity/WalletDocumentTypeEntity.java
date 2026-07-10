package com.db.dbworld.app.wallet.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "wallet_document_type", schema = "db_world",
        uniqueConstraints = @UniqueConstraint(name = "uk_wallet_type_code", columnNames = "code"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WalletDocumentTypeEntity {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(nullable = false, length = 40)  private String code;
    @Column(nullable = false, length = 100) private String displayName;
    @Column(length = 300) private String description;
    @Column(length = 40)  private String iconKey;

    @Column(nullable = false) private boolean requiresNumber;
    @Column(length = 60)      private String numberLabel;
    @Column(nullable = false) private boolean active;
    @Column(nullable = false) private int sortOrder;

    @CreationTimestamp @Column(nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp   @Column(nullable = false)                    private Instant updatedAt;
}
