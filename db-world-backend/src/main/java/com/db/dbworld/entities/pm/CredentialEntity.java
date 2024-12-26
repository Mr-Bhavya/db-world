package com.db.dbworld.entities.pm;

import com.db.dbworld.config.StringCryptoConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
@Entity
@Table(name = "CREDENTIALS", schema = "db_world")
public class CredentialEntity implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "password_manager")
    private PasswordManagerEntity passwordManager;

    @Convert(converter = StringCryptoConverter.class)
    private String username;

    @Convert(converter = StringCryptoConverter.class)
    private String password;

    @Convert(converter = StringCryptoConverter.class)
    private String pin;

    @Convert(converter = StringCryptoConverter.class)
    private String notes;

}
