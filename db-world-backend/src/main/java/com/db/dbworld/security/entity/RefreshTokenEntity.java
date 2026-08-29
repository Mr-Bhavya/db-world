package com.db.dbworld.security.entity;

import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.security.enums.ClientPlatform;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * One row per sign-in — this is the actual session record.
 *
 * <p>Tokens rotate: every refresh stamps {@link #usedAt} on the presented row and inserts a
 * successor sharing the same {@link #familyId}. A token that is presented twice is therefore
 * a replay of stolen credentials, and the whole family is revoked (see
 * {@code AuthenticationService#refreshToken}). Rows are kept after revocation rather than
 * deleted so the session list can show history and so reuse stays detectable.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "refresh_token", indexes = {
        @Index(name = "idx_refresh_token_family", columnList = "family_id"),
        @Index(name = "idx_refresh_token_user", columnList = "user")
})
@EntityListeners(AuditingEntityListener.class)
public class RefreshTokenEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * Groups a token with every successor minted from it. Rotation replaces the token but
     * keeps the family, so "this session" survives refreshes and revoking a compromised
     * session means revoking the family.
     */
    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @CreatedDate
    private Instant created;

    private Instant expiry;

    /** Last time this session minted a new access token (updated on each refresh). */
    private Instant lastUsed;

    /** How many times this session has refreshed the access token. Nullable for legacy rows. */
    private Integer refreshCount;

    /**
     * When this particular token was rotated away. Non-null means it has already been spent —
     * presenting it again is replay, not a legitimate refresh.
     */
    @Column(name = "used_at")
    private Instant usedAt;

    /** Set when the session is ended deliberately. Non-null means the token is dead. */
    @Column(name = "revoked_at")
    private Instant revokedAt;

    /** Why the session ended — surfaced in the session list and the audit trail. */
    @Column(name = "revoked_reason", length = 64)
    @Enumerated(EnumType.STRING)
    private RevokeReason revokedReason;

    /** Which client the sign-in came from, so the session list can show a sensible icon. */
    @Column(name = "platform", length = 16)
    @Enumerated(EnumType.STRING)
    private ClientPlatform platform = ClientPlatform.WEB;

    /** Raw User-Agent at sign-in, kept for the "Chrome on Windows" style summary. */
    @Column(name = "user_agent", length = 512)
    private String userAgent;

    /** Client IP at sign-in. Only ever shown to the owner of the session and to admins. */
    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user")
    private UserEntity user;

    /** A token is usable only while it is unspent, unrevoked and unexpired. */
    public boolean isActive(final Instant now) {
        return usedAt == null && revokedAt == null && expiry != null && expiry.isAfter(now);
    }

    /** Marks this token dead. No-op if it was already revoked, so the first reason wins. */
    public void revoke(final RevokeReason reason, final Instant now) {
        if (revokedAt == null) {
            revokedAt = now;
            revokedReason = reason;
        }
    }

    /** Why a session ended. Drives the wording in the session list and the audit log. */
    public enum RevokeReason {
        LOGOUT,
        LOGOUT_ALL,
        ROTATED,
        REUSE_DETECTED,
        ROLE_DOWNGRADE,
        ACCOUNT_DISABLED,
        ACCOUNT_LOCKED,
        PASSWORD_CHANGED,
        ADMIN_REVOKED,
        GOOGLE_UNLINKED,
        ACCOUNT_DELETED
    }
}
