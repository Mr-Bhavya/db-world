package com.db.dbworld.app.pm.entity;

import com.db.dbworld.security.crypto.StringCryptoConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "CREDENTIALS", schema = "db_world")
public class CredentialEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "password_manager")
    private PasswordManagerEntity passwordManager;

    // What the user calls this entry ("Netflix", "db-world SSH"). The website is optional, so the
    // name is the entry's identity. Null on rows saved before the field existed: readers fall back
    // to the host.
    @Convert(converter = StringCryptoConverter.class)
    @Column(length = 512)
    private String name;

    // LOGIN unless the user picked another kind. Null on old rows, which are logins.
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private CredentialType type;

    // Full URL the credential was saved for (e.g. "https://netflix.com"). Stored
    // in plaintext (the bare host is already plaintext in the HOST table) so the
    // vault can suggest/link sites from our own data instead of re-hitting the
    // logo.dev search API (limited quota).
    @Column(length = 1024)
    private String url;

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

    @OneToMany(mappedBy = "credential", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<CustomFieldEntity> customFields = new ArrayList<>();
}