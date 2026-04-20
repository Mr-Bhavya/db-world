package com.db.dbworld.app.pm.entity;

import com.db.dbworld.security.crypto.StringCryptoConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "CREDENTIALS", schema = "new_db_world")
public class CredentialEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "password_manager")
    private PasswordManagerEntity passwordManager;

    @Convert(converter = StringCryptoConverter.class)
    @Column(length = 512)
    private String username;

    @Convert(converter = StringCryptoConverter.class)
    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String password;

    @Convert(converter = StringCryptoConverter.class)
    @Column(length = 255)
    private String pin;

    @Convert(converter = StringCryptoConverter.class)
    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String notes;
}