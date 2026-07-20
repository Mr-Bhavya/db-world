package com.db.dbworld.app.pm.entity;

import com.db.dbworld.security.crypto.StringCryptoConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "CREDENTIAL_CUSTOM_FIELDS", schema = "db_world")
public class CustomFieldEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "credential_id", nullable = false)
    private CredentialEntity credential;

    @Column(name = "field_key", length = 255, nullable = false)
    private String fieldKey;

    @Convert(converter = StringCryptoConverter.class)
    @Column(name = "field_value", length = 512)
    private String fieldValue;

    public CustomFieldEntity(String fieldKey, String fieldValue, CredentialEntity credential) {
        this.fieldKey = fieldKey;
        this.fieldValue = fieldValue;
        this.credential = credential;
    }
}
