package com.db.dbworld.entities.user;

import com.db.dbworld.entities.pm.PasswordManagerEntity;
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
@SequenceGenerator(name="users_seq", initialValue=1001, allocationSize=1)
public class UserEntity implements Serializable {
    @Id
    @Column(name = "id")
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator="users_seq")
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
    private UserRoleEntity role;

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
