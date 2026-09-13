package com.db.dbworld.security.auth;

import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Failed sign-in throttling.
 *
 * <p>Nothing rate-limited the login endpoint before this: the only lockout in the system is the
 * admin-operated one on the user record. The headline risk was not password guessing but CPU —
 * bcrypt at cost 12 is ~250ms per attempt on a Raspberry Pi, so a few hundred concurrent attempts
 * takes the whole box down without a single correct guess.
 */
class LoginRateLimiterTest {

    private static final Instant T0 = Instant.parse("2026-09-13T10:00:00Z");
    private static final String EMAIL = "a@b.com";
    private static final String IP = "203.0.113.7";

    /** A clock the test moves by hand, so window expiry is exact rather than timing-dependent. */
    private static final class MovableClock extends Clock {
        private Instant now = T0;

        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }

        void advance(Duration d) { now = now.plus(d); }
    }

    private final MovableClock clock = new MovableClock();
    private final LoginRateLimiter limiter = new LoginRateLimiter(clock);

    private void fail(int times) {
        for (int i = 0; i < times; i++) {
            limiter.recordFailure(EMAIL, IP);
        }
    }

    @Test
    void allowsAttemptsUpToTheEmailLimit() {
        fail(LoginRateLimiter.MAX_FAILURES_PER_EMAIL - 1);
        assertThatCode(() -> limiter.checkAllowed(EMAIL, IP)).doesNotThrowAnyException();
    }

    @Test
    void throttlesTheAccountOnceItsFailureLimitIsReached() {
        fail(LoginRateLimiter.MAX_FAILURES_PER_EMAIL);

        assertThatThrownBy(() -> limiter.checkAllowed(EMAIL, IP))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("Too many failed sign-in attempts")
                .extracting(e -> ((DbWorldException) e).getHttpStatus())
                .isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    void releasesTheAccountOnceTheWindowPasses() {
        fail(LoginRateLimiter.MAX_FAILURES_PER_EMAIL);
        clock.advance(LoginRateLimiter.WINDOW.plusSeconds(1));

        assertThatCode(() -> limiter.checkAllowed(EMAIL, IP)).doesNotThrowAnyException();
    }

    @Test
    void sustainedPressureKeepsExtendingTheWindow() {
        // The expiry rides on the LATEST failure, not the first. Otherwise an attacker could keep
        // hammering and be released on the schedule of whenever their opening attempt happened.
        fail(LoginRateLimiter.MAX_FAILURES_PER_EMAIL);
        clock.advance(LoginRateLimiter.WINDOW.minusMinutes(1));
        limiter.recordFailure(EMAIL, IP);
        clock.advance(Duration.ofMinutes(2));   // past the ORIGINAL window, not the extended one

        assertThatThrownBy(() -> limiter.checkAllowed(EMAIL, IP)).isInstanceOf(DbWorldException.class);
    }

    @Test
    void aSuccessfulSignInClearsTheAccountsFailures() {
        fail(LoginRateLimiter.MAX_FAILURES_PER_EMAIL - 1);
        limiter.recordSuccess(EMAIL);
        fail(LoginRateLimiter.MAX_FAILURES_PER_EMAIL - 1);

        // Someone who mistypes, succeeds, then mistypes again starts from a clean slate.
        assertThatCode(() -> limiter.checkAllowed(EMAIL, IP)).doesNotThrowAnyException();
    }

    @Test
    void aSuccessfulSignInDoesNotClearTheAddressBudget() {
        // One valid credential is exactly what an attacker spraying an address ends up with.
        // Letting it reset the address-wide counter would hand them an unlimited budget.
        for (int i = 0; i < LoginRateLimiter.MAX_FAILURES_PER_IP; i++) {
            limiter.recordFailure("victim" + i + "@b.com", IP);
        }
        limiter.recordSuccess("victim0@b.com");

        assertThatThrownBy(() -> limiter.checkAllowed("someone-else@b.com", IP))
                .isInstanceOf(DbWorldException.class);
    }

    @Test
    void throttlesAnAddressSprayingManyDistinctAccounts() {
        // The per-email counter never trips here - every attempt names a different user, which is
        // both the credential-spray shape and the CPU-flood shape.
        for (int i = 0; i < LoginRateLimiter.MAX_FAILURES_PER_IP; i++) {
            limiter.recordFailure("user" + i + "@b.com", IP);
        }

        assertThatThrownBy(() -> limiter.checkAllowed("fresh@b.com", IP))
                .isInstanceOf(DbWorldException.class);
    }

    @Test
    void oneAddressBeingThrottledDoesNotAffectAnother() {
        for (int i = 0; i < LoginRateLimiter.MAX_FAILURES_PER_IP; i++) {
            limiter.recordFailure("user" + i + "@b.com", IP);
        }

        assertThatCode(() -> limiter.checkAllowed("fresh@b.com", "198.51.100.9"))
                .doesNotThrowAnyException();
    }

    @Test
    void emailCasingCannotBuyAFreshBudget() {
        for (int i = 0; i < LoginRateLimiter.MAX_FAILURES_PER_EMAIL; i++) {
            limiter.recordFailure("A@B.com", IP);
        }

        assertThatThrownBy(() -> limiter.checkAllowed("a@b.COM", IP))
                .isInstanceOf(DbWorldException.class);
    }

    @Test
    void aMissingIpOrEmailIsIgnoredRatherThanBecomingASharedBucket() {
        // getClientIpAddress can return null behind an odd proxy. Keying on that would put every
        // such caller in ONE bucket and lock them all out together.
        assertThatCode(() -> {
            for (int i = 0; i < LoginRateLimiter.MAX_FAILURES_PER_IP + 5; i++) {
                limiter.recordFailure(null, null);
            }
            limiter.checkAllowed(EMAIL, IP);
        }).doesNotThrowAnyException();
    }

    @Test
    void reportsHowLongIsLeft() {
        fail(LoginRateLimiter.MAX_FAILURES_PER_EMAIL);
        clock.advance(Duration.ofMinutes(5));

        assertThatThrownBy(() -> limiter.checkAllowed(EMAIL, IP))
                .hasMessageContaining("10 minutes");   // 15-minute window, 5 elapsed
    }
}
