package com.db.dbworld.app.pm.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The server's strength must be the level the vault screens used to compute themselves with
 * {@code passwordUtils.scorePassword}. The same table is in {@code passwordUtils.test.js}: change
 * one, change both.
 */
class PasswordStrengthTest {

    @ParameterizedTest(name = "[{0}] -> {1}")
    @CsvSource(delimiter = '|', quoteCharacter = '\'', value = {
            "''                               | 0",
            "a                                | 1",
            "abc                              | 1",
            "aaaaaaaa                         | 2",   // a repeat: -8
            "password                         | 2",
            "Password1                        | 3",
            "12345678                         | 1",   // a sequence: -8
            "abcdefgh                         | 2",
            "ABCDqwer                         | 2",   // both penalties are one each, case-insensitive
            "'!@#$%^&'                        | 2",   // 7 symbols = 35 bits
            "'!@#$%^&*'                       | 3",   // 8 symbols = exactly 40 bits: the edge belongs to the band above
            "'!!!@#$%^'                       | 2",   // 40 - 8
            "'!@#$%^&*()-_'                   | 4",   // exactly 60 bits
            "'!@#$%^&*()-_=+[]{}'             | 5",   // exactly 90 bits
            "'!@#$%^&*()-_=+[]{'              | 4",   // 85 bits
            "'Tr0ub4dor&3'                    | 4",
            "'correct horse battery staple'   | 5",
            "'Zx9!Zx9!Zx9!Zx9!'               | 5",
            "'xK#9mQ2$vL7@nB4&wP8!'           | 5",
            "'ñandú'                          | 2",
            "qwerty123                        | 2",
            "'Qwerty!2024'                    | 4",
    })
    void levelMatchesTheClientsScale(String password, int level) {
        assertThat(PasswordStrength.level(password)).isEqualTo(level);
    }

    // Kept out of the CSV: they hold a line break or a character outside the BMP.
    @Test
    void aLineBreakIsNotARepeatAndASurrogatePairIsTwoCharactersAsInJavaScript() {
        assertThat(PasswordStrength.level("aaa\naaa")).isEqualTo(2);   // 41 bits - 8 for "aaa"
        assertThat(PasswordStrength.level("a\n\n\nb")).isEqualTo(2);   // "." skips line breaks: no repeat
        // Six UTF-16 units of one symbol pool, 30 bits. JS sees alternating halves, not a repeat.
        assertThat(PasswordStrength.level("😀😀😀")).isEqualTo(2);
    }

    @Test
    void nullIsEmpty() {
        assertThat(PasswordStrength.level(null)).isZero();
    }
}
