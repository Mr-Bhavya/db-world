package com.db.dbworld.core.user.service;

import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.role.enums.Role;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.repository.UserRepository;
import com.db.dbworld.security.auth.SessionRevocationService;
import com.db.dbworld.security.entity.RefreshTokenEntity.RevokeReason;
import com.db.dbworld.security.repository.RefreshTokenRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Account deletion, in two stages.
 *
 * <p><b>Stage 1 — soft delete.</b> The account is disabled, every session and credential is
 * revoked, and a purge deadline is stamped on the row. The user disappears from the app
 * immediately, which is what both store policies require, but nothing is destroyed yet: signing
 * back in during the grace window restores everything. That window exists because the wallet
 * holds government IDs and the vault holds passwords — an irreversible one-click wipe reachable
 * from a stolen session is a worse failure than a delayed purge.
 *
 * <p><b>Stage 2 — purge.</b> Once the deadline passes, {@code AccountPurgeJob} calls
 * {@link #purge}, which erases the private data and detaches the rest.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class AccountDeletionService {

    /** How long a deleted account can still be recovered by signing in. */
    public static final Duration GRACE_PERIOD = Duration.ofDays(30);

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final SessionRevocationService sessionRevocationService;

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * A user-owned table and the column that points at the user.
     *
     * <p>The column is spelled out per table rather than assumed to be {@code user_id}, because
     * it genuinely varies across this schema — {@code PASSWORD_MANAGER} and {@code LOGIN_DATA}
     * use {@code user}, {@code wallet_share} uses {@code created_by_user_id}, and notifications
     * point at a user twice. A blanket {@code user_id} loop would silently skip those tables and
     * leave the private data it was supposed to erase sitting in the database.
     */
    private record UserOwnedTable(String table, String column) {}

    /** Private, user-scoped rows destroyed with the account. */
    private static final List<UserOwnedTable> PURGE_TABLES = List.of(
            new UserOwnedTable("wallet_share", "created_by_user_id"),
            new UserOwnedTable("wallet_document", "user_id"),
            new UserOwnedTable("PASSWORD_MANAGER", "user"),
            new UserOwnedTable("WATCH_PROGRESS", "user_id"),
            new UserOwnedTable("USER_INTERACTIONS", "user_id"),
            new UserOwnedTable("USER_NOTIFICATIONS", "recipient_user_id"),
            // Notifications this user caused on other people's inboxes. Left behind they would
            // render as an action by a user who no longer exists.
            new UserOwnedTable("USER_NOTIFICATIONS", "actor_user_id"),
            new UserOwnedTable("SEARCH_HISTORY", "user_id"),
            new UserOwnedTable("ipo_user_application", "user_id"),
            // Only the votes are removed. The request rows themselves have no owner column —
            // they belong to everyone who voted, so deleting them would destroy other users' data.
            new UserOwnedTable("media_request_voters", "user_id"),
            new UserOwnedTable("catalog_ingest_request_voters", "user_id"),
            new UserOwnedTable("push_device_token", "user_id"),
            new UserOwnedTable("biometric_device", "user_id"),
            // A live reset link outliving the account it belonged to would be a way
            // back into an email address someone else may later register.
            new UserOwnedTable("verification_token", "user_id")
    );

    /**
     * The vault's child rows, deleted before PASSWORD_MANAGER, in the order the foreign keys need:
     * password history and custom fields point at an entry, an entry points at its group. The group
     * delete in {@link #PURGE_TABLES} fails while any of them is left (the keys have no ON DELETE
     * CASCADE), so these run first. Each reaches the user through the group's {@code user} column.
     */
    private static final String VAULT_GROUPS = "(SELECT pm.id FROM PASSWORD_MANAGER pm WHERE pm.user = :userId)";
    private static final String VAULT_ENTRIES =
            "(SELECT c.id FROM CREDENTIALS c WHERE c.password_manager IN " + VAULT_GROUPS + ")";
    private static final List<String> VAULT_PURGE_SQL = List.of(
            "DELETE FROM CREDENTIAL_HISTORY WHERE credential_id IN " + VAULT_ENTRIES,
            "DELETE FROM CREDENTIAL_CUSTOM_FIELDS WHERE credential_id IN " + VAULT_ENTRIES,
            "DELETE FROM CREDENTIALS WHERE password_manager IN " + VAULT_GROUPS
    );

    /**
     * Rows kept with the user reference nulled.
     *
     * <p>Reviews stay so other people's threads and the rating averages keep their shape, and
     * the activity tables stay so historical totals do not silently rewrite themselves. The
     * fulfilment columns on the request tables are admin attribution on shared rows, so they are
     * detached rather than taking the whole request with them.
     */
    private static final List<UserOwnedTable> ANONYMISE_TABLES = List.of(
            new UserOwnedTable("user_reviews", "user_id"),
            new UserOwnedTable("ACTIVITY_EVENT", "user_id"),
            new UserOwnedTable("ACTIVITY_SESSION", "user_id"),
            new UserOwnedTable("user_activity_logs", "user_id"),
            new UserOwnedTable("LOGIN_DATA", "user"),
            new UserOwnedTable("media_requests", "fulfilled_by_user_id"),
            new UserOwnedTable("catalog_ingest_requests", "ingested_by_user_id")
    );

    // ==============================
    // Stage 1 — soft delete
    // ==============================

    /**
     * Marks the account for deletion and locks the user out immediately.
     *
     * @return when the data will actually be erased
     */
    @Transactional
    public Instant softDelete(final long userId, final String actor) {
        final UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "User not found"));

        if (user.isPendingDeletion()) {
            log.info("Account [{}] is already pending deletion (purge at {})",
                    user.getEmail(), user.getPurgeAfter());
            return user.getPurgeAfter();
        }

        guardLastAdmin(user);

        final Instant now = Instant.now();
        final Instant purgeAfter = now.plus(GRACE_PERIOD);

        user.setDeletedAt(now);
        user.setPurgeAfter(purgeAfter);
        // Clearing `enabled` is what makes every other enabled-check in the codebase exclude
        // this account for free. CustomAuthenticationProvider deliberately looks past it so
        // the user can still sign in to undo the deletion.
        user.setEnabled(false);
        userRepository.save(user);

        sessionRevocationService.revokeEverything(userId, RevokeReason.ACCOUNT_DELETED);

        log.warn("Account [{}] (id={}) marked for deletion by [{}] — purge at {}",
                user.getEmail(), userId, actor, purgeAfter);
        return purgeAfter;
    }

    /** Cancels a pending deletion. Called when the user signs back in during the grace window. */
    @Transactional
    public void restore(final long userId) {
        final UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "User not found"));

        if (!user.isPendingDeletion()) {
            return;
        }
        user.setDeletedAt(null);
        user.setPurgeAfter(null);
        user.setEnabled(true);
        userRepository.save(user);
        log.warn("Account [{}] (id={}) restored from pending deletion", user.getEmail(), userId);
    }

    // ==============================
    // Stage 2 — purge
    // ==============================

    /**
     * Irreversibly erases an account and its private data.
     *
     * <p>Runs in one transaction so a failure part-way cannot leave an account half-deleted,
     * which would be both a privacy problem and a referential mess. Detaching runs before
     * deleting so that a row we intend to keep is never removed by a foreign key first.
     */
    @Transactional
    public void purge(final long userId) {
        final UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "User not found"));
        final String email = user.getEmail();

        for (final UserOwnedTable target : ANONYMISE_TABLES) {
            final int updated = executeUpdate(
                    "UPDATE %s SET %s = NULL WHERE %s = :userId"
                            .formatted(target.table(), target.column(), target.column()), userId);
            if (updated > 0) {
                log.info("Detached {} rows in {}.{} from userId={}",
                        updated, target.table(), target.column(), userId);
            }
        }

        for (final String sql : VAULT_PURGE_SQL) {
            final int deleted = executeUpdate(sql, userId);
            if (deleted > 0) {
                log.info("Purged {} vault rows by [{}] for userId={}", deleted, sql, userId);
            }
        }

        for (final UserOwnedTable target : PURGE_TABLES) {
            final int deleted = executeUpdate(
                    "DELETE FROM %s WHERE %s = :userId"
                            .formatted(target.table(), target.column()), userId);
            if (deleted > 0) {
                log.info("Purged {} rows from {} (by {}) for userId={}",
                        deleted, target.table(), target.column(), userId);
            }
        }

        // Refresh tokens hang off a JPA association, so they go through the repository.
        refreshTokenRepository.deleteByUser_UserId(userId);

        userRepository.delete(user);
        entityManager.flush();

        log.warn("PURGED account [{}] (id={}) — data erased", email, userId);
    }

    /** Accounts whose grace window has elapsed. */
    @Transactional(readOnly = true)
    public List<UserEntity> findPurgeable() {
        return userRepository.findPurgeable(Instant.now());
    }

    // ==============================
    // Internal
    // ==============================

    /**
     * Runs one purge statement and turns its failure into a logged ERROR and a count of 0, so the
     * statements after it are still tried.
     *
     * <p>That does not make the purge tolerant of a missing or drifted table. This runs inside
     * {@link #purge}'s single transaction, and the JPA provider marks that transaction
     * rollback-only when a native statement fails: the swallowed exception does not undo that. The
     * remaining statements run, but at commit the whole purge is rolled back (the caller gets an
     * exception), so nothing is erased and the account stays pending deletion until the statement is
     * fixed. The ERROR log is what tells an operator why.
     */
    private int executeUpdate(final String sql, final long userId) {
        try {
            return entityManager.createNativeQuery(sql)
                    .setParameter("userId", userId)
                    .executeUpdate();
        } catch (RuntimeException e) {
            log.error("Purge statement failed and was skipped: [{}] for userId={} — {}",
                    sql, userId, e.getMessage());
            return 0;
        }
    }

    /** Refuses to delete the last admin or owner, which would lock everyone out of the console. */
    private void guardLastAdmin(final UserEntity user) {
        if (user.getRole() == null) return;
        final Role roleName = user.getRole().getName();
        if ((roleName == Role.ADMIN || roleName == Role.OWNER)
                && userRepository.countByRoleName(roleName) <= 1) {
            log.warn("Deletion refused: [{}] is the last {}", user.getEmail(), roleName);
            throw new DbWorldException(HttpStatus.CONFLICT,
                    "Cannot delete the last " + roleName + " account");
        }
    }
}
