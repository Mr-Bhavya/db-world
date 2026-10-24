package com.db.dbworld.app.pm.entity;

import com.db.dbworld.security.crypto.StringCryptoConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * A password an entry used to have, kept so a change can be undone. The newest five per entry are
 * kept (the service trims the rest). Encrypted like the live password; removed with its entry.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "CREDENTIAL_HISTORY", schema = "db_world",
        indexes = @Index(name = "idx_credential_history_credential", columnList = "credential_id, changed_at"))
public class CredentialHistoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "credential_id", nullable = false)
    private CredentialEntity credential;

    @Convert(converter = StringCryptoConverter.class)
    @Lob
    @Column(name = "password", columnDefinition = "LONGTEXT")
    private String password;

    // When this password stopped being the current one.
    @Column(name = "changed_at", nullable = false)
    private Instant changedAt;

    public CredentialHistoryEntity(CredentialEntity credential, String password, Instant changedAt) {
        this.credential = credential;
        this.password = password;
        this.changedAt = changedAt;
    }
}
