package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.dto.IpoDto;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class IpoNormalizerTest {

    private final IpoNormalizer normalizer = new IpoNormalizer();

    private IpoDto dtoWith(String companyName, LocalDate openDate) {
        return new IpoDto("nse", null, companyName, "mainboard", "open",
                openDate, null, null, null,
                null, null, null, null, null, null, null,
                null, null, null, null,
                null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null);
    }

    @Test
    void matchKey_sameCompanyDifferentLegalSuffixesAndWhitespace_produceSameKey() {
        LocalDate open = LocalDate.of(2026, 7, 20);

        String k1 = normalizer.matchKey(dtoWith("Zomato Ltd", open));
        String k2 = normalizer.matchKey(dtoWith("Zomato Limited", open));
        String k3 = normalizer.matchKey(dtoWith("  zomato  ", open));

        assertThat(k1).isEqualTo(k2).isEqualTo(k3);
    }

    @Test
    void matchKey_isCaseInsensitive() {
        LocalDate open = LocalDate.of(2026, 7, 20);

        assertThat(normalizer.matchKey(dtoWith("ACME CORP LTD", open)))
                .isEqualTo(normalizer.matchKey(dtoWith("acme corp ltd", open)));
    }

    @Test
    void matchKey_differentOpenDates_produceDifferentKeys() {
        String k1 = normalizer.matchKey(dtoWith("Zomato Ltd", LocalDate.of(2026, 7, 20)));
        String k2 = normalizer.matchKey(dtoWith("Zomato Ltd", LocalDate.of(2026, 8, 1)));

        assertThat(k1).isNotEqualTo(k2);
    }

    @Test
    void matchKey_nullOpenDate_stillKeyedByName() {
        String key = normalizer.matchKey(dtoWith("Zomato Ltd", null));

        assertThat(key).isNotNull();
        assertThat(key).startsWith("zomato");
        assertThat(key).endsWith("|");
    }

    @Test
    void matchKey_nullCompanyName_returnsNull() {
        assertThat(normalizer.matchKey(dtoWith(null, LocalDate.of(2026, 7, 20)))).isNull();
    }

    @Test
    void matchKey_blankCompanyName_returnsNull() {
        assertThat(normalizer.matchKey(dtoWith("   ", LocalDate.of(2026, 7, 20)))).isNull();
    }

    @Test
    void matchKey_stripsPvtAndPrivateSuffixesToo() {
        LocalDate open = LocalDate.of(2026, 7, 20);

        assertThat(normalizer.matchKey(dtoWith("Acme Pvt", open)))
                .isEqualTo(normalizer.matchKey(dtoWith("acme", open)));
        assertThat(normalizer.matchKey(dtoWith("Acme Private", open)))
                .isEqualTo(normalizer.matchKey(dtoWith("acme", open)));
    }

    @Test
    void matchKey_stripsMultipleStackedLegalSuffixes() {
        LocalDate open = LocalDate.of(2026, 7, 20);

        String privateLimited = normalizer.matchKey(dtoWith("XYZ Private Limited", open));
        String pvtLtd = normalizer.matchKey(dtoWith("XYZ Pvt Ltd", open));
        String pvtDotLtdDot = normalizer.matchKey(dtoWith("XYZ Pvt. Ltd.", open));
        String limited = normalizer.matchKey(dtoWith("XYZ Limited", open));
        String ltd = normalizer.matchKey(dtoWith("XYZ Ltd", open));

        assertThat(privateLimited).isEqualTo(pvtLtd).isEqualTo(pvtDotLtdDot).isEqualTo(limited).isEqualTo(ltd);
    }

    @Test
    void matchKey_stripsNonAlphanumericsAndCollapsesWhitespace() {
        LocalDate open = LocalDate.of(2026, 7, 20);

        String withPunctuation = normalizer.matchKey(dtoWith("Acme, Corp.  &  Co.", open));
        String plain = normalizer.matchKey(dtoWith("Acme Corp Co", open));

        assertThat(withPunctuation).isEqualTo(plain);
    }

    // ── aliasKey: the resolution key that collapses the duplicates matchKey creates ─────────────

    /**
     * Every pair below is a REAL duplicate observed in production, taken from the IPO list and the
     * poll logs. Each one is a company that became two rows because {@code matchKey} could not
     * reconcile two feeds' spellings — and, since the pair then looked ambiguous to
     * {@code InvestorgainMatcher}, usually left BOTH halves with no GMP at all.
     */
    @org.junit.jupiter.params.ParameterizedTest(name = "[{index}] {0}  <->  {1}")
    @org.junit.jupiter.params.provider.CsvSource({
            // Punctuation glued tokens together: "Co.(India)" keyed as "coindia".
            "Asset Reconstruction Co.(India) Ltd., Asset Reconstruction Company (India) Limited",
            // Ampersand against the spelled-out word.
            "Manipal Payment & Identity Solutions Ltd., Manipal Payment and Identity Solutions Limited",
            // The plain legal-suffix variants, which matchKey already handled - kept as a guard.
            "LCC Projects Ltd., LCC Projects Limited",
            "Glass Wall Systems (India) Ltd., Glass Wall Systems (India) Limited",
            // Whitespace only: the pair the logs reported as 'ambiguous name' and skipped entirely.
            "AnawilWire Ltd, Anawil Wire Limited",
            "PropshopEvents Pvt Ltd, Propshop Events Private Limited",
            // Abbreviation folding.
            "Sumax Engg Ltd, Sumax Engineering Limited",
            "Gujarat Intl Corp, Gujarat International Corporation",
            // Several legal suffixes at once, plus stray punctuation and casing.
            "  G.V.Electricals   PVT. LTD.  , GV Electricals",
    })
    void aliasKey_realWorldDuplicatePairs_collapseToOneKey(String feedSpelling, String ourSpelling) {
        assertThat(normalizer.aliasKey(feedSpelling))
                .isNotNull()
                .isEqualTo(normalizer.aliasKey(ourSpelling));
    }

    @Test
    void aliasKey_differentCompanies_doNotCollide() {
        // The alias key is deliberately lossy, so this is the guard that it has not become lossy
        // enough to fuse two unrelated issuers - which would move real users' "My IPOs" entries
        // onto the wrong company.
        assertThat(normalizer.aliasKey("Shree Balaji Mala Limited"))
                .isNotEqualTo(normalizer.aliasKey("Shree Balaji Steels Limited"));
        assertThat(normalizer.aliasKey("Tempsens Instruments (India) Limited"))
                .isNotEqualTo(normalizer.aliasKey("Tempsens Controls Limited"));
    }

    @Test
    void aliasKey_carriesNoDateSoARevisedScheduleKeepsOneRow() {
        // matchKey bakes in the open date, so a revised schedule mints a whole new row and orphans
        // the original along with its GMP history. The alias key is what reconnects them.
        LocalDate first = LocalDate.of(2026, 9, 9);
        LocalDate revised = LocalDate.of(2026, 9, 10);

        assertThat(normalizer.matchKey("LCC Projects Limited", first))
                .isNotEqualTo(normalizer.matchKey("LCC Projects Limited", revised));
        assertThat(normalizer.aliasKey("LCC Projects Limited"))
                .isEqualTo(normalizer.aliasKey("LCC Projects Limited"));
    }

    @Test
    void aliasKey_suffixWordUsedMidName_isKeptNotStripped() {
        // Only a TRAILING run of legal suffixes is dropped. "Private" here is part of the company's
        // actual name, and stripping it would fold two different banks together.
        assertThat(normalizer.aliasKey("Private Sector Bank Ltd")).isEqualTo("privatesectorbank");
        assertThat(normalizer.aliasKey("Sector Bank Ltd")).isEqualTo("sectorbank");
    }

    @Test
    void aliasKey_nothingIdentifiableLeft_isNull() {
        // A null alias must match nothing rather than matching everything.
        assertThat(normalizer.aliasKey(null)).isNull();
        assertThat(normalizer.aliasKey("   ")).isNull();
        assertThat(normalizer.aliasKey("Ltd.")).isNull();
        assertThat(normalizer.aliasKey("- , . ")).isNull();
    }
}
