package com.db.dbworld.entities.pm;

import com.db.dbworld.entities.user.UserEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "PASSWORD_MANAGER", schema = "db_world")
public class PasswordManagerEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinColumn(name = "host", referencedColumnName = "name")
    private HostEntity host;

    @OneToMany(fetch = FetchType.LAZY, mappedBy = "passwordManager", cascade = CascadeType.ALL)
    private List<CredentialEntity> credentials;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user", referencedColumnName = "id")
    private UserEntity userEntity;

}
