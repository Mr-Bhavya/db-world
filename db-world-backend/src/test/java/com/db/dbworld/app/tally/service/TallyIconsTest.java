package com.db.dbworld.app.tally.service;

import com.db.dbworld.app.tally.entity.TallyGroupKind;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guessing a group's icon from its name.
 *
 * <p>A pure function, so it is tested as one. The rules are an ordered list and the order is
 * the part that breaks silently — "road trip" matching the suitcase before the car reads as a
 * bug to the person who typed it, and nothing else in the app would notice.
 */
@DisplayName("group icon guessing")
class TallyIconsTest {

    private static String forName(String name) {
        return TallyIcons.resolve(null, name, null, TallyGroupKind.GROUP);
    }

    @Test
    @DisplayName("picks from the obvious word in the name")
    void picksFromTheName() {
        assertThat(forName("Home")).isEqualTo("🏠");
        assertThat(forName("Goa trip")).isEqualTo("🏖️");
        assertThat(forName("Office lunch")).isEqualTo("💼");
        assertThat(forName("Wedding shopping")).isEqualTo("💍");
    }

    @Test
    @DisplayName("prefers the more specific phrase when two words could match")
    void moreSpecificWins() {
        // "road trip" has to beat "trip", or every drive becomes a suitcase.
        assertThat(forName("Road trip")).isEqualTo("🚗");
        assertThat(forName("Ladakh trip")).isEqualTo("🧳");
        // "flatmates" beats nothing else, but must not fall through to the generic group icon.
        assertThat(forName("Flatmates")).isEqualTo("🏘️");
    }

    @Test
    @DisplayName("is case and position insensitive")
    void caseInsensitive() {
        assertThat(forName("OUR HOME")).isEqualTo(forName("our home"));
        assertThat(forName("Weekend TRek")).isEqualTo("🏕️");
    }

    @Test
    @DisplayName("falls back to the category when the name says nothing")
    void fallsBackToCategory() {
        assertThat(TallyIcons.resolve(null, "Ravi and co", "Trip", TallyGroupKind.GROUP))
                .isEqualTo("🧳");
    }

    @Test
    @DisplayName("an explicit choice is never overridden")
    void explicitWins() {
        // Somebody who picked an icon meant it, even if the name suggests another.
        assertThat(TallyIcons.resolve("🐾", "Home", null, TallyGroupKind.GROUP))
                .isEqualTo("🐾");
        assertThat(TallyIcons.resolve("  🐾  ", "Home", null, TallyGroupKind.GROUP))
                .isEqualTo("🐾");
    }

    @Test
    @DisplayName("each kind has its own fallback when nothing matches")
    void fallbackPerKind() {
        assertThat(TallyIcons.resolve(null, "Zzz", null, TallyGroupKind.GROUP))
                .isEqualTo(TallyIcons.DEFAULT_GROUP);
        assertThat(TallyIcons.resolve(null, "Zzz", null, TallyGroupKind.DIRECT))
                .isEqualTo(TallyIcons.DEFAULT_DIRECT);
        assertThat(TallyIcons.resolve(null, "Zzz", null, TallyGroupKind.PERSONAL))
                .isEqualTo(TallyIcons.DEFAULT_PERSONAL);
    }

    @Test
    @DisplayName("copes with nothing at all rather than throwing")
    void nullSafe() {
        assertThat(TallyIcons.resolve(null, null, null, TallyGroupKind.GROUP))
                .isEqualTo(TallyIcons.DEFAULT_GROUP);
        assertThat(TallyIcons.resolve("", "", "", TallyGroupKind.GROUP))
                .isEqualTo(TallyIcons.DEFAULT_GROUP);
    }
}
