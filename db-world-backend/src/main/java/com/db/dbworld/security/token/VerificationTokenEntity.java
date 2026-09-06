package com.db.dbworld.security.token;

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
 * A single-use, time-limited token emailed to a user to prove they control the mailbox.
 *
 * <p>Only the SHA-256 of the token is stored, the same way biometric device tokens are handled.
 * The raw value exists once, in the email — so a database leak yields nothing an attacker can
 * redeem, which matters most for {@link Purpose#PASSWORD_RESET} where a live token is equivalent
 * to the password itself.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "verification_token", schema = "db_world", indexes = {
        @Index(name = "idx_verification_token_user_purpose", columnList = "user_id, purpose")
})
@EntityListeners(AuditingEntityListener.class)
public class VerificationTokenEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** SHA-256 hex of the raw token — never store the token itself. */
    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    private Purpose purpose;

    @CreatedDate
    private Instant created;

    @Column(nullable = false)
    private Instant expiry;

    /** Set the moment the token is redeemed. Non-null means it is spent and cannot be reused. */
    @Column(name = "used_at")
    private Instant usedAt;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private UserEntity user;

    public boolean isRedeemable(final Instant now) {
        return usedAt == null && expiry != null && expiry.isAfter(now);
    }

    public enum Purpose {
        /** Proves the address given at registration is really the registrant's. */
        EMAIL_VERIFICATION,
        /**
         * Lets someone who has lost their password set a new one. Deliberately shorter-lived
         * than verification: a live one is as good as the password.
         */
        PASSWORD_RESET
    }
}
