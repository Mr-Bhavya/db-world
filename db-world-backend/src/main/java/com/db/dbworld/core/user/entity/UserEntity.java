package com.db.dbworld.core.user.entity;

import com.db.dbworld.app.pm.entity.PasswordManagerEntity;
import com.db.dbworld.core.role.entity.RoleEntity;
import com.db.dbworld.security.entity.RefreshTokenEntity;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Getter
@Setter
@Entity
@EntityListeners(AuditingEntityListener.class)
@Table(name = "USERS", schema = "db_world")
public class UserEntity implements Serializable {
    @Id
    @Column(name = "id")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long userId;

    private String firstName;

    private String lastName;

    @JsonFormat(pattern = "dd-MM-yyyy")
    private Date dob;

    private String gender;

    private Long mobileNo;

    @Column(unique = true)
    private String email;

    private String password;

    @JsonProperty
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "role", referencedColumnName = "id")
    private RoleEntity role;

    @Column(name = "account_non_locked", nullable = false)
    private boolean accountNonLocked = true;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    @CreatedDate
    private Date creationDate;

    @LastModifiedDate
    private Date lastModifiedDate;

    @JsonIgnore
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RefreshTokenEntity> refreshTokens = new ArrayList<>();

    @JsonIgnore
    @OneToMany(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "password_manager", referencedColumnName = "id")
    private List<PasswordManagerEntity> passwordManagerEntities;

    @Override
    public String toString() {
        return String.valueOf(userId);
    }
}
