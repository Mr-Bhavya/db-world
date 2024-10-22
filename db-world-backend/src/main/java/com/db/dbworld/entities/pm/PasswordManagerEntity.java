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
    private String host;

    @OneToMany(fetch = FetchType.LAZY, mappedBy = "passwordManager", cascade = CascadeType.ALL)
    @Column(name = "password_manager")
    private List<CredentialEntity> credentials;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user", referencedColumnName = "id")
    private UserEntity userEntity;

}
