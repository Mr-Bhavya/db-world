package com.db.dbworld.security.auth;

import com.db.dbworld.core.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

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
     * <p>Runs in its own transaction so a caller that later rolls back cannot silently undo a
     * revocation — if we have decided the user's tokens are dead, they stay dead.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void bump(final long userId, final String reason) {
        final int updated = userRepository.bumpTokenVersion(userId);
        cache.remove(userId);
        if (updated > 0) {
            log.info("Token version bumped for userId={} ({}) — all access tokens invalidated",
                    userId, reason);
        } else {
            log.warn("Token version bump affected no rows for userId={} ({})", userId, reason);
        }
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
