package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.dto.IpoDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class IpoMergeServiceTest {

    private IpoMergeService mergeService;

    private static final LocalDate OPEN = LocalDate.of(2026, 7, 20);

    @BeforeEach
    void setUp() {
        mergeService = new IpoMergeService(new IpoNormalizer());
    }

    /** Builds a fully-populated dto for a given source so precedence/fallback is easy to assert on. */
    private IpoDto full(String source) {
        return new IpoDto(source, null, "Acme Corp Ltd", "mainboard", "open-" + source,
                OPEN, LocalDate.of(2026, 7, 24), LocalDate.of(2026, 7, 28), LocalDate.of(2026, 7, 30),
                new BigDecimal("100.00"), new BigDecimal("110.00"), 130, "500 Cr-" + source,
                "NSE-" + source, new BigDecimal("135.00"), new BigDecimal("22.73"),
                new BigDecimal("25.00"), new BigDecimal("22.00"),
                new BigDecimal("5.00"), new BigDecimal("10.00"), new BigDecimal("2.50"), new BigDecimal("6.75"),
                "finalized-" + source, "Link Intime-" + source, "https://registrar/" + source);
    }

    @Test
    void merge_threeSourcesSameIpo_pickEachFieldFromItsPrecedenceWinner() {
        IpoDto nse = full("nse");
        IpoDto ipoguru = full("ipoguru");
        IpoDto chittorgarh = full("chittorgarh");

        List<IpoDto> merged = mergeService.merge(List.of(nse, ipoguru, chittorgarh));

        assertThat(merged).hasSize(1);
        IpoDto m = merged.get(0);

        // primary group -> nse wins
        assertThat(m.status()).isEqualTo("open-nse");
        assertThat(m.listingExchange()).isEqualTo("NSE-nse");
        assertThat(m.listingPrice()).isEqualByComparingTo("135.00");
        assertThat(m.companyName()).isEqualTo("Acme Corp Ltd");
        assertThat(m.issueSize()).isEqualTo("500 Cr-nse");
        assertThat(m.openDate()).isEqualTo(OPEN);

        // volatile group -> ipoguru wins
        assertThat(m.gmp()).isEqualByComparingTo("25.00");
        assertThat(m.subTotal()).isEqualByComparingTo("6.75");

        // registrar group -> chittorgarh wins
        assertThat(m.allotmentStatus()).isEqualTo("finalized-chittorgarh");
        assertThat(m.registrar()).isEqualTo("Link Intime-chittorgarh");
        assertThat(m.registrarUrl()).isEqualTo("https://registrar/chittorgarh");

        assertThat(m.matchKey()).isNotNull();
    }

    @Test
    void merge_groupMissingPreferredSource_fallsBackToNextInPrecedence() {
        // Primary group precedence is [nse, ipoguru, chittorgarh]; no nse dto present here,
        // so ipoguru should supply the primary-group fields.
        IpoDto ipoguru = full("ipoguru");
        IpoDto chittorgarh = full("chittorgarh");

        List<IpoDto> merged = mergeService.merge(List.of(ipoguru, chittorgarh));

        assertThat(merged).hasSize(1);
        IpoDto m = merged.get(0);

        assertThat(m.status()).isEqualTo("open-ipoguru");
        assertThat(m.listingExchange()).isEqualTo("NSE-ipoguru");
    }

    @Test
    void merge_fieldMissingFromAllPrecedenceSources_fallsBackToAnyNonNullInGroup() {
        // allotmentStatus's precedence is [chittorgarh, ipoguru, nse]. Both precedence-listed
        // sources present here (nse, ipoguru) leave it null, so the only way the merged value
        // can come through is the true fallback branch — any non-null value anywhere in the
        // group — picking it up from "manual", a source that isn't even in the precedence list.
        IpoDto nse = new IpoDto("nse", null, "Acme Corp Ltd", null, null,
                OPEN, null, null, null,
                null, null, null, null, null, null, null,
                null, null, null, null, null, null,
                null, null, null);
        IpoDto ipoguru = new IpoDto("ipoguru", null, "Acme Corp Ltd", null, null,
                OPEN, null, null, null,
                null, null, null, null, null, null, null,
                null, null, null, null, null, null,
                null, null, null);
        IpoDto manual = new IpoDto("manual", null, "Acme Corp Ltd", null, null,
                OPEN, null, null, null,
                null, null, null, null, null, null, null,
                null, null, null, null, null, null,
                "finalized-manual-only", null, null);

        List<IpoDto> merged = mergeService.merge(List.of(nse, ipoguru, manual));

        assertThat(merged).hasSize(1);
        assertThat(merged.get(0).allotmentStatus()).isEqualTo("finalized-manual-only");
    }

    @Test
    void merge_twoDifferentIpos_producesTwoMergedRows() {
        IpoDto acme = full("nse");
        IpoDto other = new IpoDto("nse", null, "Widget Industries Ltd", "mainboard", "open",
                LocalDate.of(2026, 8, 1), null, null, null,
                null, null, null, null, null, null, null,
                null, null, null, null, null, null,
                null, null, null);

        List<IpoDto> merged = mergeService.merge(List.of(acme, other));

        assertThat(merged).hasSize(2);
        assertThat(merged).extracting(IpoDto::companyName)
                .containsExactlyInAnyOrder("Acme Corp Ltd", "Widget Industries Ltd");
    }

    @Test
    void merge_dtoWithNullMatchKey_isDropped() {
        IpoDto uningestable = new IpoDto("nse", null, null, null, null,
                OPEN, null, null, null,
                null, null, null, null, null, null, null,
                null, null, null, null, null, null,
                null, null, null);
        IpoDto valid = full("ipoguru");

        List<IpoDto> merged = mergeService.merge(List.of(uningestable, valid));

        assertThat(merged).hasSize(1);
        assertThat(merged.get(0).companyName()).isEqualTo("Acme Corp Ltd");
    }

    @Test
    void merge_setsMatchKeyOnEveryMergedDto() {
        IpoDto nse = full("nse");

        List<IpoDto> merged = mergeService.merge(List.of(nse));

        assertThat(merged.get(0).matchKey()).isEqualTo(new IpoNormalizer().matchKey(nse));
    }
}
