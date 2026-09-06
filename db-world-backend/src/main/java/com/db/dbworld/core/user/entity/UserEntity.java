package com.db.dbworld.core.user.entity;

import com.db.dbworld.app.pm.entity.PasswordManagerEntity;
import com.db.dbworld.core.role.entity.RoleEntity;
import com.db.dbworld.security.entity.RefreshTokenEntity;
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
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Getter
@Setter
@Entity
@EntityListeners(AuditingEntityListener.class)
@Table(name = "USERS", schema = "db_world")
public class UserEntity implements Serializable {
    @Id
    @Column(name = "id")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long userId;

    private String firstName;

    private String lastName;

    @JsonFormat(pattern = "dd-MM-yyyy")
    private Date dob;

    private String gender;

    private Long mobileNo;

    @Column(unique = true)
    private String email;

    /**
     * Nullable: a Google-only account never had one. Every password check must therefore
     * treat {@code null} as "this account has no password credential" rather than letting
     * an encoder compare against null.
     */
    private String password;

    /** Google {@code sub} claim — the stable per-account identifier. Null until Google is linked. */
    @Column(name = "google_sub", unique = true)
    private String googleSub;

    /** Google {@code picture} claim, kept only so the avatar renders without a second call. */
    @Column(name = "avatar_url", length = 512)
    private String avatarUrl;

    /** True once any identity provider has proven the mailbox belongs to this user. */
    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified = false;

    /**
     * Bumped whenever every outstanding access token for this user must die at once —
     * role downgrade, disable, lock, password change, refresh-token reuse, deletion.
     * It rides in the JWT as the {@code tv} claim and is checked on decode, which is what
     * makes revocation immediate instead of waiting out the 5-minute access-token TTL.
     */
    @Column(name = "token_version", nullable = false)
    private int tokenVersion = 0;

    /**
     * Set when the user (or an admin) deletes the account. The row stays for the grace
     * window so a mistaken or hijacked deletion can be undone by signing back in; the
     * scheduled purge removes it for good once {@link #purgeAfter} passes.
     */
    @Column(name = "deleted_at")
    private Instant deletedAt;

    /** End of the deletion grace window. Null unless {@link #deletedAt} is set. */
    @Column(name = "purge_after")
    private Instant purgeAfter;

    @JsonProperty
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "role", referencedColumnName = "id")
    private RoleEntity role;

    @Column(name = "account_non_locked", nullable = false)
    private boolean accountNonLocked = true;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

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

    /** True while the account sits in the deletion grace window awaiting purge. */
    public boolean isPendingDeletion() {
        return deletedAt != null;
    }

    /** True when a local password credential exists — false for a Google-only account. */
    public boolean hasPassword() {
        return password != null && !password.isBlank();
    }

    /** True once a Google identity has been linked to this account. */
    public boolean hasGoogleLinked() {
        return googleSub != null && !googleSub.isBlank();
    }

    @Override
    public String toString() {
        return String.valueOf(userId);
    }
}
