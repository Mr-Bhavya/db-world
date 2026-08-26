package com.db.dbworld.app.cinema.catalog.tags.services;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tag-name canonicalisation. This carries weight it didn't used to: tag types moved from the
 * {@code RecordTagType} enum to free-form strings, so this is now the only thing stopping
 * "Diwali Special", "diwali special" and "DIWALI_SPECIAL" becoming three separate tags that look
 * identical in the admin UI.
 */
class TagNamesTest {

    @Test
    void canonicalize_displayName_becomesUpperSnakeSlug() {
        assertThat(TagNames.canonicalize("Diwali Special")).isEqualTo("DIWALI_SPECIAL");
        assertThat(TagNames.canonicalize("Hidden Gems")).isEqualTo("HIDDEN_GEMS");
    }

    @Test
    void canonicalize_variantSpellings_collapseToOneIdentity() {
        // The whole point: these must not become different tags.
        String expected = "DIWALI_SPECIAL";
        assertThat(TagNames.canonicalize("Diwali Special")).isEqualTo(expected);
        assertThat(TagNames.canonicalize("diwali special")).isEqualTo(expected);
        assertThat(TagNames.canonicalize("DIWALI_SPECIAL")).isEqualTo(expected);
        assertThat(TagNames.canonicalize("  diwali   special  ")).isEqualTo(expected);
        assertThat(TagNames.canonicalize("Diwali-Special")).isEqualTo(expected);
    }

    @Test
    void canonicalize_existingBuiltInNames_areUnchanged() {
        // Built-ins already stored in record_tags must round-trip identically, or every existing
        // rail would stop matching its tag.
        assertThat(TagNames.canonicalize("TRENDING")).isEqualTo("TRENDING");
        assertThat(TagNames.canonicalize("TOP_10")).isEqualTo("TOP_10");
        assertThat(TagNames.canonicalize("AVAILABLE_FOR_DOWNLOAD")).isEqualTo("AVAILABLE_FOR_DOWNLOAD");
        assertThat(TagNames.canonicalize("NEW_SEASON")).isEqualTo("NEW_SEASON");
    }

    @Test
    void canonicalize_blankOrPunctuationOnly_isNull() {
        assertThat(TagNames.canonicalize(null)).isNull();
        assertThat(TagNames.canonicalize("")).isNull();
        assertThat(TagNames.canonicalize("   ")).isNull();
        assertThat(TagNames.canonicalize("!!!")).isNull();
        assertThat(TagNames.canonicalize("___")).isNull();
    }

    @Test
    void canonicalize_overlongName_isTruncatedToColumnWidthWithoutTrailingUnderscore() {
        String slug = TagNames.canonicalize("a".repeat(40) + " " + "b".repeat(40));

        assertThat(slug).hasSizeLessThanOrEqualTo(TagNames.MAX_LENGTH);
        // Truncating mid-word must not leave a dangling separator.
        assertThat(slug).doesNotEndWith("_");
    }

    @Test
    void canonicalize_isIdempotent() {
        String once  = TagNames.canonicalize("Weekend Binge!");
        String twice = TagNames.canonicalize(once);

        // Re-saving an existing tag must not shift its identity.
        assertThat(twice).isEqualTo(once);
    }
}
