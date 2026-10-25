package com.db.dbworld.app.pm.service;

import com.db.dbworld.core.exception.DbWorldException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * At most 60 vault secret reads per user per minute: each reveal of one value, and each offline
 * snapshot, counts one. A person clicking Show and Copy stays far below it; a stolen session
 * draining the vault through the reveal endpoint does not.
 *
 * <p>The backend had no general per-user rate limiter ({@code LoginRateLimiter} counts failed
 * sign-ins per email and address, a different job), so this is a small fixed-window counter: in
 * memory and per instance, like that one, which fits the single-instance deployment. A restart
 * resets it. Keyed by user id, so the map is bounded by the number of users and is not pruned.
 */
@Component
public class SecretReadRateLimiter {

    /** Reads allowed per user in one window. */
    public static final int MAX_READS_PER_WINDOW = 60;
    static final Duration WINDOW = Duration.ofMinutes(1);

    private record Window(Instant end, int reads) {
    }

    private final Map<Long, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    @Autowired
    public SecretReadRateLimiter() {
        this(Clock.systemUTC());
    }

    /** Tests pass a clock they can move. */
    public SecretReadRateLimiter(Clock clock) {
        this.clock = clock;
    }

    /**
     * Counts one read for the user, or refuses it.
     *
     * @throws DbWorldException 429 when the user has used up this minute's reads
     */
    public void acquire(Long userId) {
        Instant now = clock.instant();
        Window window = windows.compute(userId, (id, current) ->
                current == null || !now.isBefore(current.end())
                        ? new Window(now.plus(WINDOW), 1)
                        : new Window(current.end(), current.reads() + 1));
        if (window.reads() > MAX_READS_PER_WINDOW) {
            throw new DbWorldException(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many vault reads. Try again in a minute.");
        }
    }
}
