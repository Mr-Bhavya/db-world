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

/**
 * A per-device biometric unlock credential. The device keeps a high-entropy token behind its
 * fingerprint/face (hardware Keystore); we persist only a SHA-256 hash of it, so a DB leak yields
 * nothing usable. It is exchanged (POST /api/auth/biometric/exchange) for a normal session and is
 * independently revocable, so losing a device never requires a password change.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "biometric_device")
@EntityListeners(AuditingEntityListener.class)
public class BiometricDeviceEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** SHA-256 hex of the raw device token — never store the token itself. */
    @Column(nullable = false, unique = true, length = 64)
    private String tokenHash;

    /** Stable client-generated device identifier (one credential per user + device). */
    @Column(nullable = false)
    private String deviceId;

    /** Human-friendly label for the device-management UI (e.g. "Pixel 8"). */
    private String deviceLabel;

    @CreatedDate
    private Instant created;

    /** Last successful unlock (also pushes {@link #expiry} out — sliding window). */
    private Instant lastUsed;

    private Instant expiry;

    private boolean revoked;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private UserEntity user;
}
