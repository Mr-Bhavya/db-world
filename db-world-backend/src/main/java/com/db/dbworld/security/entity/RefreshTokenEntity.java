package com.db.dbworld.entities.user;

import jakarta.persistence.*;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "refresh_token")
@EntityListeners(AuditingEntityListener.class)
public class RefreshTokenEntity {

//    @Id
//    @GeneratedValue(strategy = GenerationType.IDENTITY)
//    private int tokenId;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @CreatedDate
    private Instant created;

    private Instant expiry;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user")
    private UserEntity user;
}
