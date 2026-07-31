package com.db.dbworld.app.ipo.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class IpoStatusCanonicalizerTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 7, 26);

    // ── Time-aware transitions (open/listing at 10:00 IST, close at 17:00 IST) ────────────────────

    @Test
    void deriveStatus_openDayBeforeTenAm_isStillUpcoming() {
        LocalDate open = LocalDate.of(2026, 7, 26);
        assertThat(IpoStatusCanonicalizer.deriveStatus(
                open, open.plusDays(3), null, open.atTime(9, 0))).isEqualTo("upcoming");
        assertThat(IpoStatusCanonicalizer.deriveStatus(
                open, open.plusDays(3), null, open.atTime(10, 0))).isEqualTo("open"); // exactly 10:00 → open
    }

    @Test
    void deriveStatus_closeDayBeforeFivePm_isOpen_afterIsClosed() {
        LocalDate close = LocalDate.of(2026, 7, 27);
        LocalDate open = close.minusDays(2);
        assertThat(IpoStatusCanonicalizer.deriveStatus(
                open, close, null, close.atTime(16, 30))).isEqualTo("open");
        assertThat(IpoStatusCanonicalizer.deriveStatus(
                open, close, null, close.atTime(17, 0))).isEqualTo("closed"); // exactly 17:00 → closed
    }

    @Test
    void deriveStatus_listingDayBeforeTenAm_isClosed_afterIsListed() {
        LocalDate listing = LocalDate.of(2026, 7, 30);
        LocalDate close = listing.minusDays(3);
        assertThat(IpoStatusCanonicalizer.deriveStatus(
                close.minusDays(2), close, listing, listing.atTime(9, 30))).isEqualTo("closed");
        assertThat(IpoStatusCanonicalizer.deriveStatus(
                close.minusDays(2), close, listing, listing.atTime(10, 0))).isEqualTo("listed");
    }

    @Test
    void isPastCutoffs_matchTheirIstTimes() {
        LocalDate day = LocalDate.of(2026, 7, 27);
        assertThat(IpoStatusCanonicalizer.isPastOpen(day, day.atTime(9, 59))).isFalse();
        assertThat(IpoStatusCanonicalizer.isPastOpen(day, day.atTime(10, 0))).isTrue();
        assertThat(IpoStatusCanonicalizer.isPastClose(day, day.atTime(16, 59))).isFalse();
        assertThat(IpoStatusCanonicalizer.isPastClose(day, day.atTime(17, 0))).isTrue();
        assertThat(IpoStatusCanonicalizer.isPastClose(day, day.minusDays(1).atTime(23, 0))).isFalse();
        assertThat(IpoStatusCanonicalizer.isPastClose(day, day.plusDays(1).atTime(0, 1))).isTrue();
        assertThat(IpoStatusCanonicalizer.isPastClose(null, LocalDateTime.now())).isFalse();
    }

    @Test
    void deriveStatus_beforeOpen_isUpcoming() {
        assertThat(IpoStatusCanonicalizer.deriveStatus(
                LocalDate.of(2026, 7, 30), LocalDate.of(2026, 8, 3), null, TODAY)).isEqualTo("upcoming");
    }

    @Test
    void deriveStatus_withinWindow_isOpen() {
        assertThat(IpoStatusCanonicalizer.deriveStatus(
                LocalDate.of(2026, 7, 23), LocalDate.of(2026, 7, 27), null, TODAY)).isEqualTo("open");
        // Boundary days (open == today, close == today) are inclusive.
        assertThat(IpoStatusCanonicalizer.deriveStatus(TODAY, TODAY, null, TODAY)).isEqualTo("open");
    }

    @Test
    void deriveStatus_pastCloseNotYetListed_isClosed() {
        assertThat(IpoStatusCanonicalizer.deriveStatus(
                LocalDate.of(2026, 7, 20), LocalDate.of(2026, 7, 24), LocalDate.of(2026, 7, 29), TODAY)).isEqualTo("closed");
        // No listing date announced yet either → still closed.
        assertThat(IpoStatusCanonicalizer.deriveStatus(
                LocalDate.of(2026, 7, 20), LocalDate.of(2026, 7, 24), null, TODAY)).isEqualTo("closed");
    }

    @Test
    void deriveStatus_listingDateReached_isListed() {
        assertThat(IpoStatusCanonicalizer.deriveStatus(
                LocalDate.of(2026, 7, 10), LocalDate.of(2026, 7, 14), LocalDate.of(2026, 7, 18), TODAY)).isEqualTo("listed");
        // Listing today counts as listed.
        assertThat(IpoStatusCanonicalizer.deriveStatus(
                LocalDate.of(2026, 7, 10), LocalDate.of(2026, 7, 14), TODAY, TODAY)).isEqualTo("listed");
    }

    @Test
    void deriveStatus_onlyFutureListingDate_isUpcoming() {
        assertThat(IpoStatusCanonicalizer.deriveStatus(
                null, null, LocalDate.of(2026, 8, 5), TODAY)).isEqualTo("upcoming");
    }

    @Test
    void deriveStatus_noDates_returnsNull() {
        assertThat(IpoStatusCanonicalizer.deriveStatus(null, null, null, TODAY)).isNull();
        assertThat(IpoStatusCanonicalizer.deriveStatus(LocalDate.of(2026, 7, 20), null, null, (LocalDate) null)).isNull();
    }

    @Test
    void nullOrBlank_returnsNull() {
        assertThat(IpoStatusCanonicalizer.canonical(null)).isNull();
        assertThat(IpoStatusCanonicalizer.canonical("")).isNull();
        assertThat(IpoStatusCanonicalizer.canonical("   ")).isNull();
    }

    @Test
    void openAliases_mapToOpen() {
        assertThat(IpoStatusCanonicalizer.canonical("open")).isEqualTo("open");
        assertThat(IpoStatusCanonicalizer.canonical("Active")).isEqualTo("open");
        assertThat(IpoStatusCanonicalizer.canonical("LIVE")).isEqualTo("open");
        assertThat(IpoStatusCanonicalizer.canonical("Ongoing")).isEqualTo("open");
        assertThat(IpoStatusCanonicalizer.canonical("Subscription Open")).isEqualTo("open");
    }

    @Test
    void upcomingAliases_mapToUpcoming() {
        assertThat(IpoStatusCanonicalizer.canonical("Upcoming")).isEqualTo("upcoming");
        assertThat(IpoStatusCanonicalizer.canonical("Forthcoming")).isEqualTo("upcoming");
        assertThat(IpoStatusCanonicalizer.canonical("To Open")).isEqualTo("upcoming");
        assertThat(IpoStatusCanonicalizer.canonical("Pre-Open")).isEqualTo("upcoming");
    }

    @Test
    void closedAliases_mapToClosed() {
        assertThat(IpoStatusCanonicalizer.canonical("Closed")).isEqualTo("closed");
        assertThat(IpoStatusCanonicalizer.canonical("Close")).isEqualTo("closed");
        assertThat(IpoStatusCanonicalizer.canonical("Subscription Closed")).isEqualTo("closed");
        assertThat(IpoStatusCanonicalizer.canonical("Bidding Closed")).isEqualTo("closed");
    }

    @Test
    void listedAliases_mapToListed() {
        assertThat(IpoStatusCanonicalizer.canonical("Listed")).isEqualTo("listed");
        assertThat(IpoStatusCanonicalizer.canonical("Listing")).isEqualTo("listed");
        assertThat(IpoStatusCanonicalizer.canonical("Listed Today")).isEqualTo("listed");
    }

    @Test
    void unrecognizedStatus_returnsLowercasedTrimmedRawInsteadOfDropping() {
        assertThat(IpoStatusCanonicalizer.canonical("  Some Weird Status  ")).isEqualTo("some weird status");
    }

    @Test
    void alreadyCanonical_isIdempotent() {
        assertThat(IpoStatusCanonicalizer.canonical("open")).isEqualTo("open");
        assertThat(IpoStatusCanonicalizer.canonical("upcoming")).isEqualTo("upcoming");
        assertThat(IpoStatusCanonicalizer.canonical("closed")).isEqualTo("closed");
        assertThat(IpoStatusCanonicalizer.canonical("listed")).isEqualTo("listed");
    }

    @Test
    void canonicalType_nullOrBlank_returnsNull() {
        assertThat(IpoStatusCanonicalizer.canonicalType(null)).isNull();
        assertThat(IpoStatusCanonicalizer.canonicalType("")).isNull();
        assertThat(IpoStatusCanonicalizer.canonicalType("   ")).isNull();
    }

    @Test
    void canonicalType_mainboardAliases_mapToMainboard() {
        assertThat(IpoStatusCanonicalizer.canonicalType("mainboard")).isEqualTo("mainboard");
        assertThat(IpoStatusCanonicalizer.canonicalType("Main Board")).isEqualTo("mainboard");
        assertThat(IpoStatusCanonicalizer.canonicalType("Main-Board")).isEqualTo("mainboard");
        assertThat(IpoStatusCanonicalizer.canonicalType("Mainline")).isEqualTo("mainboard");
        assertThat(IpoStatusCanonicalizer.canonicalType("MB")).isEqualTo("mainboard");
        assertThat(IpoStatusCanonicalizer.canonicalType("Mainboard IPO")).isEqualTo("mainboard");
        assertThat(IpoStatusCanonicalizer.canonicalType("EQ")).isEqualTo("mainboard");
        assertThat(IpoStatusCanonicalizer.canonicalType("Equity")).isEqualTo("mainboard");
    }

    @Test
    void canonicalType_smeAliases_mapToSme() {
        assertThat(IpoStatusCanonicalizer.canonicalType("sme")).isEqualTo("sme");
        assertThat(IpoStatusCanonicalizer.canonicalType("SME IPO")).isEqualTo("sme");
        assertThat(IpoStatusCanonicalizer.canonicalType("SME Platform")).isEqualTo("sme");
        assertThat(IpoStatusCanonicalizer.canonicalType("NSE Emerge")).isEqualTo("sme");
        assertThat(IpoStatusCanonicalizer.canonicalType("BSE SME")).isEqualTo("sme");
    }

    @Test
    void canonicalType_unrecognizedType_returnsLowercasedTrimmedRawInsteadOfDropping() {
        assertThat(IpoStatusCanonicalizer.canonicalType("  Some Weird Type  ")).isEqualTo("some weird type");
    }

    @Test
    void canonicalType_alreadyCanonical_isIdempotent() {
        assertThat(IpoStatusCanonicalizer.canonicalType("mainboard")).isEqualTo("mainboard");
        assertThat(IpoStatusCanonicalizer.canonicalType("sme")).isEqualTo("sme");
    }
}
