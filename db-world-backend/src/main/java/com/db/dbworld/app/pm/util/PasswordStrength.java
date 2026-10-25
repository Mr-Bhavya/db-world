package com.db.dbworld.app.pm.util;

import java.util.regex.Pattern;

/**
 * A port of {@code passwordUtils.scorePassword} (db-world-frontend): the vault list used to score
 * each password in the browser, and now gets the level from the server, which alone sees the
 * passwords. It must give the same level for the same password; {@code PasswordStrengthTest} and
 * {@code passwordUtils.test.js} pin the same table.
 *
 * <p>Same as the JS: lengths count UTF-16 units ({@code String.length()} and JS {@code length}
 * agree), the pool is 26 + 26 + 10 + 32 by character class, minus 8 for a run of three of one
 * character, minus 8 for a common sequence, then the bands.
 */
public final class PasswordStrength {

    private static final Pattern LOWER = Pattern.compile("[a-z]");
    private static final Pattern UPPER = Pattern.compile("[A-Z]");
    private static final Pattern DIGIT = Pattern.compile("[0-9]");
    private static final Pattern OTHER = Pattern.compile("[^a-zA-Z0-9]");
    // JS /i without the u flag folds ASCII only, as CASE_INSENSITIVE without UNICODE_CASE does.
    private static final Pattern SEQUENCE = Pattern.compile("0123|1234|abcd|qwer|asdf", Pattern.CASE_INSENSITIVE);

    private PasswordStrength() {
    }

    /** 0 for a null or empty password, else 1 (very weak) to 5 (excellent). */
    public static int level(String pw) {
        if (pw == null || pw.isEmpty()) return 0;

        double bits = pw.length() * log2(poolSize(pw));
        if (hasRunOfThree(pw)) bits -= 8;
        if (SEQUENCE.matcher(pw).find()) bits -= 8;
        bits = Math.max(bits, 0);

        if (bits < 28) return 1;
        if (bits < 40) return 2;
        if (bits < 60) return 3;
        if (bits < 90) return 4;
        return 5;
    }

    /** A password as the vault compares and scores it: trimmed, null as empty. */
    public static String trimmed(String password) {
        return password == null ? "" : password.trim();
    }

    private static int poolSize(String pw) {
        int size = 0;
        if (LOWER.matcher(pw).find()) size += 26;
        if (UPPER.matcher(pw).find()) size += 26;
        if (DIGIT.matcher(pw).find()) size += 10;
        if (OTHER.matcher(pw).find()) size += 32;
        return size == 0 ? 1 : size;
    }

    /**
     * JS {@code Math.log2} is exact for a power of two (32, the symbols-only pool: 8 symbols are
     * exactly 40 bits, a band edge); {@code log(n) / log(2)} need not be, so those are counted.
     * The other pools are not powers of two, and their products never land on a band edge.
     */
    private static double log2(int n) {
        return Integer.bitCount(n) == 1 ? Integer.numberOfTrailingZeros(n) : Math.log(n) / Math.log(2);
    }

    /**
     * JS {@code /(.)\1{2,}/}: three equal UTF-16 units in a row, where "." is anything but a line
     * terminator. Done by hand because Java's "." matches a whole surrogate pair, and JS's matches
     * one half.
     */
    private static boolean hasRunOfThree(String pw) {
        for (int i = 0; i + 2 < pw.length(); i++) {
            char c = pw.charAt(i);
            if (c != '\n' && c != '\r' && c != ' ' && c != ' '
                    && pw.charAt(i + 1) == c && pw.charAt(i + 2) == c) {
                return true;
            }
        }
        return false;
    }
}
