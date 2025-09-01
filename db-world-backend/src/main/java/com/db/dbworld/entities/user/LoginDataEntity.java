package com.db.dbworld.entities.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.util.Date;

@Getter
@Setter
@Entity
@EntityListeners(AuditingEntityListener.class)
@Table(name = "LOGIN_DATA", schema = "db_world")
@SequenceGenerator(name="LOGIN_DATA_SEQ", initialValue=1, allocationSize=1)
public class LoginDataEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "LOGIN_DATA_SEQ")
    private int id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user", referencedColumnName = "id",  nullable = false, updatable = false)
    public UserEntity user;

    @CreatedDate
    @Column(nullable = false)
    private Date lastLoginDate;

    @Column(nullable = true)
    private String loginAgent;

}
