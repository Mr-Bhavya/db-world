package com.db.dbworld.core.user.service;

import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.security.repository.RefreshTokenRepository;
import com.db.dbworld.security.token.VerificationTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/** Completes deletions whose grace window has run out, and keeps the session table tidy. */
@Log4j2
@Component
@RequiredArgsConstructor
public class AccountPurgeJob {

    /**
     * Revoked and expired session rows are kept for a while so the session list can show recent
     * history and so refresh-token reuse stays detectable after the fact. Ninety days is well
     * past the 30-day token lifetime, so nothing still in use is ever swept.
     */
    private static final Duration SESSION_RETENTION = Duration.ofDays(90);

    private final AccountDeletionService accountDeletionService;
    private final RefreshTokenRepository refreshTokenRepository;
    private final VerificationTokenRepository verificationTokenRepository;

    /**
     * Purges each due account in its own call so one failure — a locked row, an unexpected
     * constraint — cannot stop the rest from being erased. A deletion that silently stops
     * half-way through the queue is the failure mode worth guarding against here.
     */
    @Scheduled(cron = "${dbworld.account.purge-cron:0 30 3 * * *}")
    public void purgeDueAccounts() {
        final List<UserEntity> due = accountDeletionService.findPurgeable();
        if (due.isEmpty()) {
            return;
        }

        log.info("Account purge: {} account(s) past their grace window", due.size());
        int purged = 0;
        for (final UserEntity user : due) {
            try {
                accountDeletionService.purge(user.getUserId());
                purged++;
            } catch (RuntimeException e) {
                log.error("Account purge failed for userId={} — will retry on the next run: {}",
                        user.getUserId(), e.getMessage(), e);
            }
        }
        log.warn("Account purge complete: {}/{} account(s) erased", purged, due.size());
    }

    /** Drops long-dead session and verification rows so the tables do not grow without bound. */
    @Scheduled(cron = "${dbworld.account.session-sweep-cron:0 45 3 * * *}")
    @Transactional
    public void sweepExpiredSessions() {
        final int removed = refreshTokenRepository
                .deleteExpiredBefore(Instant.now().minus(SESSION_RETENTION));
        if (removed > 0) {
            log.info("Swept {} expired session row(s)", removed);
        }

        // Verification and reset tokens are single-use and short-lived, so nothing is kept for
        // history here - a day past expiry is already well beyond any legitimate use.
        final int tokens = verificationTokenRepository
                .deleteExpiredBefore(Instant.now().minus(Duration.ofDays(1)));
        if (tokens > 0) {
            log.info("Swept {} expired verification token(s)", tokens);
        }
    }
}
