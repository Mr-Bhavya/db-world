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
                null, null, null, null, null, null,
                null, null, null, null, null);
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

    @Test
    void withMatchKey_returnsCopyWithMatchKeySetAndOtherFieldsPreserved() {
        IpoDto dto = dtoWith("Zomato Ltd", LocalDate.of(2026, 7, 20));

        IpoDto copy = normalizer.withMatchKey(dto);

        assertThat(copy.matchKey()).isEqualTo(normalizer.matchKey(dto));
        assertThat(copy.companyName()).isEqualTo(dto.companyName());
        assertThat(copy.source()).isEqualTo(dto.source());
        assertThat(copy.status()).isEqualTo(dto.status());
        assertThat(copy.ipoType()).isEqualTo(dto.ipoType());
        assertThat(copy.openDate()).isEqualTo(dto.openDate());
    }

    @Test
    void withMatchKey_uningestableDto_hasNullMatchKey() {
        IpoDto dto = dtoWith(null, LocalDate.of(2026, 7, 20));

        assertThat(normalizer.withMatchKey(dto).matchKey()).isNull();
    }
}
