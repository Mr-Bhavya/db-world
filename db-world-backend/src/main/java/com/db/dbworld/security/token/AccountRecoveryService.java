package com.db.dbworld.security.token;

import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.mail.MailService;
import com.db.dbworld.core.mail.MailTemplates;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.repository.UserRepository;
import com.db.dbworld.security.auth.SessionRevocationService;
import com.db.dbworld.security.entity.RefreshTokenEntity.RevokeReason;
import com.db.dbworld.security.token.VerificationTokenEntity.Purpose;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Email verification and password reset.
 *
 * <p>Both prove one thing — that the caller can read mail at an address — and everything else
 * follows from that. Verification is what makes the address trustworthy enough to auto-link a
 * Google identity to; reset is what stops a forgotten password meaning a lost account.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class AccountRecoveryService {

    /** Long enough that a distracted user still has a working link the next morning. */
    private static final Duration VERIFICATION_TTL = Duration.ofHours(24);

    /** Short on purpose: a live reset token is equivalent to knowing the password. */
    private static final Duration RESET_TTL = Duration.ofHours(1);

    /** 256 bits of entropy — a reset link must not be brute-forceable. */
    private static final int TOKEN_BYTES = 32;

    private final UserRepository userRepository;
    private final VerificationTokenRepository tokenRepository;
    private final SessionRevocationService sessionRevocationService;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;

    private final SecureRandom random = new SecureRandom();

    @Value("${app.public-base-url:https://db-world.in}")
    private String publicBaseUrl;

    // ==============================
    // Email verification
    // ==============================

    /** Issues and emails a verification link. No-op if the address is already verified. */
    @Transactional
    public void sendVerificationEmail(final long userId) {
        final UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "User not found"));

        if (user.isEmailVerified()) {
            log.debug("Verification skipped: [{}] is already verified", user.getEmail());
            return;
        }

        final String raw = issueToken(user, Purpose.EMAIL_VERIFICATION, VERIFICATION_TTL);
        final String link = publicBaseUrl + "/verify-email?token=" + raw;
        mailService.send(user.getEmail(), MailTemplates.verifyEmailSubject(),
                MailTemplates.verifyEmail(link));
        log.info("Verification email issued for [{}]", user.getEmail());
    }

    /** Redeems a verification token. Idempotent for the caller: a spent token simply fails. */
    @Transactional
    public void confirmEmail(final String rawToken) {
        final VerificationTokenEntity token =
                redeem(rawToken, Purpose.EMAIL_VERIFICATION, "verification");

        final UserEntity user = token.getUser();
        user.setEmailVerified(true);
        userRepository.save(user);
        log.info("Email verified for [{}]", user.getEmail());
    }

    // ==============================
    // Password reset
    // ==============================

    /**
     * Starts a password reset.
     *
     * <p>Returns nothing and never reports whether the address exists. Any difference in
     * response — a message, a status code, even a noticeably faster reply — turns this endpoint
     * into a way to enumerate who has an account here, which for a site holding document wallets
     * is itself worth protecting. The mail send is async partly for that reason.
     */
    @Transactional
    public void requestPasswordReset(final String email) {
        if (email == null || email.isBlank()) {
            return;
        }
        final Optional<UserEntity> found = userRepository.findByEmail(email.trim().toLowerCase());
        if (found.isEmpty()) {
            log.info("Password reset requested for an unknown address — answering normally");
            return;
        }

        final UserEntity user = found.get();
        if (user.isPendingDeletion()) {
            // Signing in is what restores a deleted account; letting a reset link do it silently
            // would hand a deleted account back without the owner ever choosing to.
            log.warn("Password reset refused: [{}] is pending deletion", user.getEmail());
            return;
        }

        final String raw = issueToken(user, Purpose.PASSWORD_RESET, RESET_TTL);
        final String link = publicBaseUrl + "/reset-password?token=" + raw;
        mailService.send(user.getEmail(), MailTemplates.resetPasswordSubject(),
                MailTemplates.resetPassword(link));
        log.info("Password reset email issued for [{}]", user.getEmail());
    }

    /**
     * Completes a reset: sets the new password and signs the account out everywhere.
     *
     * <p>The sign-out is the point, not a side effect. Someone resetting a password usually
     * suspects another party has access, and leaving that party's sessions alive would defeat
     * the exercise. Biometric enrollments go too — one of those can mint a fresh session with
     * no password at all.
     */
    @Transactional
    public void resetPassword(final String rawToken, final String newPassword) {
        if (newPassword == null || newPassword.length() < 6) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST,
                    "Password must be at least 6 characters");
        }

        final VerificationTokenEntity token = redeem(rawToken, Purpose.PASSWORD_RESET, "reset");
        final UserEntity user = token.getUser();

        user.setPassword(passwordEncoder.encode(newPassword));
        // Redeeming the link proved control of the mailbox, which is exactly what verification
        // asks for — so an unverified account becomes verified here rather than being told to
        // go and click a second link in the same inbox.
        user.setEmailVerified(true);
        userRepository.save(user);

        sessionRevocationService.revokeEverything(user.getUserId(), RevokeReason.PASSWORD_CHANGED);
        log.warn("Password reset completed for [{}] — all sessions and devices revoked",
                user.getEmail());
    }

    // ==============================
    // Internal
    // ==============================

    /**
     * Mints a token, stores only its hash, and invalidates any earlier one of the same purpose.
     *
     * @return the raw token — the only time it exists outside the email
     */
    private String issueToken(final UserEntity user, final Purpose purpose, final Duration ttl) {
        tokenRepository.invalidateOutstanding(user.getUserId(), purpose, Instant.now());

        final byte[] bytes = new byte[TOKEN_BYTES];
        random.nextBytes(bytes);
        final String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        final VerificationTokenEntity token = new VerificationTokenEntity();
        token.setUser(user);
        token.setPurpose(purpose);
        token.setTokenHash(sha256Hex(raw));
        token.setExpiry(Instant.now().plus(ttl));
        tokenRepository.save(token);

        return raw;
    }

    /** Looks a token up by hash, checks it is redeemable, and marks it spent. */
    private VerificationTokenEntity redeem(final String rawToken, final Purpose purpose,
                                           final String label) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Missing " + label + " token");
        }

        final VerificationTokenEntity token = tokenRepository
                .findByTokenHashWithUser(sha256Hex(rawToken))
                .filter(t -> t.getPurpose() == purpose)
                .orElseThrow(() -> {
                    log.warn("Rejected {} token: unknown or wrong purpose", label);
                    return new DbWorldException(HttpStatus.BAD_REQUEST,
                            "This link is not valid. Request a new one.");
                });

        if (!token.isRedeemable(Instant.now())) {
            log.warn("Rejected {} token for [{}]: already used or expired",
                    label, token.getUser().getEmail());
            throw new DbWorldException(HttpStatus.BAD_REQUEST,
                    "This link has expired or has already been used. Request a new one.");
        }

        token.setUsedAt(Instant.now());
        tokenRepository.save(token);
        return token;
    }

    private static String sha256Hex(final String value) {
        try {
            final byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
