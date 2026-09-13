package com.db.dbworld.core.user;

/**
 * The one place a password length rule is written down.
 *
 * <p>It was written down in five: {@code @Size(min = 8, max = 100)} on four DTOs, and a
 * hand-rolled {@code length() < 6} inside {@code AccountRecoveryService.resetPassword}. The
 * inline one was missed when the minimum went from 6 to 8, so the reset-password link — the
 * path someone uses precisely because they are already worried about their account — was the
 * one route still accepting a six-character password. Registration refused it; the reset form
 * took it happily.
 *
 * <p>Constants rather than a custom validator so {@code @Size} can keep using them: annotation
 * arguments must be compile-time constants, which these are.
 *
 * <p>The frontend mirrors this in {@code shared/auth/passwordPolicy.js}. Two languages cannot
 * share one declaration, but each side now has exactly one place to change.
 */
public final class PasswordPolicy {

    /** NIST SP 800-63B's floor. */
    public static final int MIN_LENGTH = 8;

    /**
     * Not a security control — BCrypt only reads the first 72 bytes, so length past that adds
     * nothing either way. This is here to stop an unbounded string reaching the encoder at all.
     */
    public static final int MAX_LENGTH = 100;

    /** Shared copy, so every rejection says the same thing. */
    public static final String TOO_SHORT_MESSAGE =
            "Password must be at least " + MIN_LENGTH + " characters";

    private PasswordPolicy() {
    }
}
