package com.db.dbworld.security.auth;

import com.db.dbworld.core.exception.DbWorldException;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Throttles failed sign-in attempts, per account and per source address.
 *
 * <h2>Why</h2>
 * Nothing rate-limited {@code POST /api/auth/login}. The only lockout in the system is
 * {@code UserServiceImpl}'s admin-operated one — no failed-attempt counter existed anywhere, so an
 * attacker could try passwords against an account indefinitely, against a minimum password length
 * that was six characters.
 *
 * <p>The more immediate problem was availability, not guessing. Verifying a password is bcrypt at
 * cost 12 — deliberately ~250ms of CPU — and this runs on a Raspberry Pi. A few hundred concurrent
 * login attempts is enough to saturate every core and take down everything the box serves,
 * streaming included, without a single correct guess. Bcrypt's cost is a defence against offline
 * cracking and a liability against online flooding; this is what makes it only the former.
 *
 * <h2>Two keys, deliberately</h2>
 * <ul>
 *   <li><b>Per email</b> — catches the classic case, many passwords against one account. Tight
 *       limit, because a real person does not fail five times in a quarter of an hour.</li>
 *   <li><b>Per IP</b> — catches what the email key cannot: one password sprayed across many
 *       accounts, and the CPU flood above, where every attempt names a different (or nonexistent)
 *       user. Looser, since a household or office NAT shares one address.</li>
 * </ul>
 *
 * <h2>Scope</h2>
 * In-memory and per-instance, which matches a single-instance deployment. It is a throttle, not an
 * audit trail: state is deliberately lost on restart, and a restart being a reset is acceptable
 * because the attacker does not control when we restart. Moving to multiple instances would mean
 * moving this to shared storage — until then, a dependency on Redis or Bucket4j would buy nothing.
 *
 * <p>Counts FAILURES only. A successful sign-in clears the account's record immediately, so a user
 * who mistypes a password twice and then gets it right starts clean.
 */
@Log4j2
@Component
public class LoginRateLimiter {

    /** Failures allowed against one account before it is throttled. */
    static final int MAX_FAILURES_PER_EMAIL = 5;
    /** Failures allowed from one address before it is throttled, across all accounts. */
    static final int MAX_FAILURES_PER_IP = 20;
    /** How long failures are remembered, and how long a throttle lasts once tripped. */
    static final Duration WINDOW = Duration.ofMinutes(15);

    /**
     * Prune when the map exceeds this. Entries are only removed lazily on access, so without a
     * ceiling a spray across many distinct emails would grow the map without bound — a memory
     * exhaustion vector opened by the very thing meant to close one.
     */
    private static final int PRUNE_THRESHOLD = 10_000;

    private final Map<String, Counter> byEmail = new ConcurrentHashMap<>();
    private final Map<String, Counter> byIp = new ConcurrentHashMap<>();
    private final Clock clock;

    public LoginRateLimiter() {
        this(Clock.systemUTC());
    }

    /** Test-friendly constructor with an injectable clock. */
    LoginRateLimiter(Clock clock) {
        this.clock = clock;
    }

    /** A failure count and the instant the window holding it expires. */
    private static final class Counter {
        private final AtomicLong count = new AtomicLong();
        private volatile Instant expiresAt;

        Counter(Instant expiresAt) {
            this.expiresAt = expiresAt;
        }
    }

    /**
     * Rejects the attempt if either key is currently throttled. Call BEFORE verifying the password
     * — the point is to avoid spending the bcrypt cycles at all.
     *
     * @throws DbWorldException 429, naming how long is left
     */
    public void checkAllowed(String email, String ipAddress) {
        Instant now = clock.instant();
        Duration emailWait = remaining(byEmail.get(key(email)), MAX_FAILURES_PER_EMAIL, now);
        Duration ipWait = remaining(byIp.get(key(ipAddress)), MAX_FAILURES_PER_IP, now);
        Duration wait = emailWait.compareTo(ipWait) >= 0 ? emailWait : ipWait;
        if (wait.isZero()) {
            return;
        }
        log.warn("Login throttled (email={}, ip={}, retryInSec={})", email, ipAddress, wait.toSeconds());
        throw new DbWorldException(HttpStatus.TOO_MANY_REQUESTS,
                "Too many failed sign-in attempts. Try again in " + describe(wait) + ".");
    }

    /** Records a rejected sign-in against both keys. */
    public void recordFailure(String email, String ipAddress) {
        Instant now = clock.instant();
        increment(byEmail, key(email), now);
        increment(byIp, key(ipAddress), now);
    }

    /**
     * Clears the account's failures after a correct password.
     *
     * <p>The IP counter is deliberately NOT cleared: one valid credential is exactly what an
     * attacker spraying an address would obtain, and letting it reset the address-wide budget
     * would hand them an unlimited one.
     */
    public void recordSuccess(String email) {
        byEmail.remove(key(email));
    }

    private static Duration remaining(Counter counter, int limit, Instant now) {
        if (counter == null || counter.expiresAt.isBefore(now) || counter.count.get() < limit) {
            return Duration.ZERO;
        }
        return Duration.between(now, counter.expiresAt);
    }

    private void increment(Map<String, Counter> map, String key, Instant now) {
        if (key == null) {
            return;
        }
        pruneIfCrowded(map, now);
        // Each new failure pushes the expiry out, so sustained pressure stays throttled rather
        // than being released on the schedule of whenever the FIRST attempt happened to land.
        Counter counter = map.compute(key, (k, existing) ->
                (existing == null || existing.expiresAt.isBefore(now)) ? new Counter(now.plus(WINDOW)) : existing);
        counter.count.incrementAndGet();
        counter.expiresAt = now.plus(WINDOW);
    }

    private static void pruneIfCrowded(Map<String, Counter> map, Instant now) {
        if (map.size() < PRUNE_THRESHOLD) {
            return;
        }
        map.values().removeIf(c -> c.expiresAt.isBefore(now));
    }

    /** Lower-cased so casing cannot be used to get a fresh budget per attempt. */
    private static String key(String raw) {
        return (raw == null || raw.isBlank()) ? null : raw.toLowerCase().trim();
    }

    private static String describe(Duration wait) {
        long minutes = wait.toMinutes();
        return minutes >= 1 ? minutes + " minute" + (minutes == 1 ? "" : "s") : "under a minute";
    }
}
