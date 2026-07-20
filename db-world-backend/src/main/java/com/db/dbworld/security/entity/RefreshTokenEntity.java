package com.db.dbworld.security.entity;

import com.db.dbworld.core.user.entity.UserEntity;
import jakarta.persistence.*;
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

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @CreatedDate
    private Instant created;

    private Instant expiry;

    /** Last time this session minted a new access token (updated on each refresh). */
    private Instant lastUsed;

    /** How many times this session has refreshed the access token. Nullable for legacy rows. */
    private Integer refreshCount;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user")
    private UserEntity user;
}
