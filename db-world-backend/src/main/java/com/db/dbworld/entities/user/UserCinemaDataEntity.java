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
@Table(name = "USER_CINEMA_DATA", schema = "db_world")
@SequenceGenerator(name="USER_CINEMA_DATA_SEQ", allocationSize=1)
public class UserCinemaDataEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "USER_CINEMA_DATA_SEQ")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user", nullable = false)
    private UserEntity user;

    private String event;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String value;

    @CreatedDate
    @Column(nullable = false)
    private Date time;

}
