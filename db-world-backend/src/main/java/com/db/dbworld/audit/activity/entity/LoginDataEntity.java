package com.db.dbworld.audit.activity.entity;

import com.db.dbworld.core.user.entity.UserEntity;
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
public class LoginDataEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user", referencedColumnName = "id",  nullable = false, updatable = false)
    public UserEntity user;

    @CreatedDate
    @Column(nullable = false)
    private Date lastLoginDate;

    @Column(nullable = true)
    private String loginAgent;

}
