package com.db.dbworld.security.auth;

import com.db.dbworld.core.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Owns the per-user token version — the mechanism that makes revocation immediate.
 *
 * <p>Access tokens are stateless and live 5 minutes, so revoking a refresh token only stops
 * the user minting the <em>next</em> one; the token already in their hands keeps working
 * until it expires. For a role downgrade or a disabled account that window is not acceptable,
 * so every access token also carries a {@code tv} claim which {@link TokenVersionValidator}
 * checks on decode. Bumping the version invalidates every outstanding token at once.
 *
 * <p>That check runs on every authenticated request, so the version is cached in-process.
 * A local map is deliberate rather than lazy: the backend runs as a single instance, and this
 * keeps the auth hot path free of any dependency that could be down. If it ever scales out,
 * {@link #invalidate} is the one place that would need to publish to the other nodes.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class TokenVersionService {

    /** Name of the JWT claim carrying the version the token was minted at. */
    public static final String CLAIM = "tv";

    /**
     * Safety net for versions changed outside this process (a manual DB edit, a second
     * instance). Every in-process bump invalidates the entry outright, so correctness does
     * not depend on this expiring.
     */
    private static final Duration TTL = Duration.ofSeconds(60);

    private final UserRepository userRepository;

    private final Map<Long, Entry> cache = new ConcurrentHashMap<>();

    private record Entry(int version, Instant readAt) {
        boolean isFresh(final Instant now) {
            return readAt.plus(TTL).isAfter(now);
        }
    }

    /**
     * Current version for a user, from cache when fresh.
     *
     * <p>A missing user yields {@code -1}, which can never equal a real token's claim, so a
     * token belonging to a deleted account fails validation rather than passing by default.
     */
    public int currentVersion(final long userId) {
        final Instant now = Instant.now();
        final Entry cached = cache.get(userId);
        if (cached != null && cached.isFresh(now)) {
            return cached.version();
        }
        final int version = userRepository.findTokenVersion(userId).orElse(-1);
        cache.put(userId, new Entry(version, now));
        return version;
    }

    /**
     * Invalidates every access token the user holds right now.
     *
     * <h3>Joins the caller's transaction, and MUST</h3>
     * This was {@code REQUIRES_NEW}, on the reasoning that a caller which later rolled back
     * should not be able to silently undo a revocation. That reasoning is sound in the
     * abstract and was a self-deadlock in practice, because every caller reaches here having
     * already written to the very row this updates.
     *
     * <p>The password-reset path is the clearest case. {@code AccountRecoveryService
     * .resetPassword} sets the new password on the user entity, then calls
     * {@code revokeEverything} -> {@code revokeAll}, whose first statement is a
     * {@code @Modifying(flushAutomatically = true)} query — which flushes that pending
     * {@code UPDATE users} and takes an exclusive lock on the row. A new transaction then
     * tried to update the SAME row, blocked on a lock held by the transaction that was
     * suspended waiting for it, and sat there until {@code innodb_lock_wait_timeout}. Not a
     * race: it happened on every reset, and the request took the full 50 seconds before
     * failing with "Lock wait timeout exceeded". Admin role change, disable and lock all
     * reach {@code revokeAll} through the same write-then-revoke shape.
     *
     * <p>The guarantee being given up was also not the one it appeared to be. The session
     * revocation itself — {@code revokeAllForUser}, the statement immediately before this —
     * has always run in the caller's transaction, so a rollback already undid that. Only the
     * version bump was isolated, which meant a rollback left the two halves disagreeing.
     * Joining makes revocation atomic: either the password changed and every token died, or
     * neither happened. That is the more defensible of the two behaviours, and the reason a
     * rollback here is harmless — if the password change rolled back, the old password still
     * works and there is nothing to revoke from.
     */
    @Transactional
    public void bump(final long userId, final String reason) {
        final int updated = userRepository.bumpTokenVersion(userId);
        evictAfterCommit(userId);
        if (updated > 0) {
            log.info("Token version bumped for userId={} ({}) — all access tokens invalidated",
                    userId, reason);
        } else {
            log.warn("Token version bump affected no rows for userId={} ({})", userId, reason);
        }
    }

    /**
     * Drops the cached version once the surrounding transaction has actually committed.
     *
     * <p>Evicting inline was safe while this ran in its own transaction, because the commit
     * followed within microseconds. Now that it joins the caller, the gap between the bump and
     * the commit is as long as the rest of that caller's work — and any authenticated request
     * arriving in that window would read the pre-bump value (read-committed, the new one is
     * not visible yet) and cache it for the full TTL. The eviction would already have happened,
     * so nothing would clear it: a user who was supposed to be signed out everywhere would keep
     * working for up to a minute.
     *
     * <p>Falls back to evicting immediately when there is no transaction to hang off, so a
     * direct call outside one still behaves.
     */
    private void evictAfterCommit(final long userId) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            cache.remove(userId);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(final int status) {
                // afterCompletion rather than afterCommit: on rollback the row is unchanged,
                // but the cache may have been repopulated mid-transaction and there is no
                // value in keeping a guess. Dropping it costs one query.
                cache.remove(userId);
            }
        });
    }

    /** Drops a cached version without touching the database. */
    public void invalidate(final long userId) {
        cache.remove(userId);
    }

    /** Clears the whole cache. Used by tests and after a bulk purge. */
    public void invalidateAll() {
        cache.clear();
    }
}
