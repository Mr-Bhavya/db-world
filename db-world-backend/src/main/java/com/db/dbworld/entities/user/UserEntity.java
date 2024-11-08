package com.db.dbworld.entities.user;

import com.db.dbworld.entities.pm.PasswordManagerEntity;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.util.Date;
import java.util.List;

@Getter
@Setter
@Entity
@EntityListeners(AuditingEntityListener.class)
@Table(name = "USERS", schema = "db_world")
@SequenceGenerator(name="users_seq", initialValue=1001, allocationSize=1)
public class UserEntity {
    @Id
    @Column(name = "id")
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator="users_seq")
    private long userId;
    private String firstName;
    private String lastName;
    private String dob;
    private String gender;
    private Long mobileNo;
    @Column(unique = true, nullable = false)
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

    @OneToMany(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "password_manager", referencedColumnName = "id")
    private List<PasswordManagerEntity> passwordManagerEntities;

    @Override
    public String toString() {
        return "Users{" +
                "userId='" + userId + '\'' +
                ", firstName='" + firstName + '\'' +
                ", lastName='" + lastName + '\'' +
                ", gender='" + gender + '\'' +
                ", mobileNo='" + mobileNo + '\'' +
                ", email='" + email + '\'' +
                ", password='" + password + '\'' +
                ", role='" + role.getName() + '\'' +
                '}';
    }
}
