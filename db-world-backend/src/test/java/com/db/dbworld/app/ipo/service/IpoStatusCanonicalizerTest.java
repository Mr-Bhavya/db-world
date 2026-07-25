package com.db.dbworld.app.ipo.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class IpoStatusCanonicalizerTest {

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
}
