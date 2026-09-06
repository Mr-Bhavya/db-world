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
    /** Semantic icon name ("passport", "vehicle", "bank"), resolved to a component by the client.
     *  Deliberately NOT an icon-library class name — that would couple the schema to whatever the
     *  frontend renders with today. */
    @Column(length = 40)  private String iconKey;
    /** Grouping for the type picker (IDENTITY, VEHICLE, FINANCIAL, ...). Nullable so an
     *  admin-created type without one still works; the client files those under "Other". */
    @Column(length = 40)  private String category;

    @Column(nullable = false) private boolean requiresNumber;
    /**
     * Whether documents of this type expire at all. NULLABLE on purpose, and null does NOT mean
     * false: it means nobody has said, which is the state every admin-created type starts in. The
     * client shows the optional expiry field unless this is explicitly false, because offering a
     * field nobody fills costs far less than hiding one that was needed.
     */
    private Boolean hasExpiry;
    @Column(length = 60)      private String numberLabel;
    @Column(nullable = false) private boolean active;
    @Column(nullable = false) private int sortOrder;

    @CreationTimestamp @Column(nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp   @Column(nullable = false)                    private Instant updatedAt;
}
