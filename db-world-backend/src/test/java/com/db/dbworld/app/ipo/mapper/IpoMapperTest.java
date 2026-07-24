package com.db.dbworld.app.ipo.mapper;

import com.db.dbworld.app.ipo.dto.*;
import com.db.dbworld.app.ipo.entity.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class IpoMapperTest {

    IpoMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new IpoMapper();
    }

    private IpoListingEntity fullListing() {
        return IpoListingEntity.builder()
                .id("ipo-1")
                .matchKey("acme-corp-2026")
                .companyName("Acme Corp")
                .ipoType("mainboard")
                .status("open")
                .openDate(LocalDate.of(2026, 7, 20))
                .closeDate(LocalDate.of(2026, 7, 24))
                .allotmentDate(LocalDate.of(2026, 7, 28))
                .listingDate(LocalDate.of(2026, 7, 30))
                .priceMin(new BigDecimal("100.00"))
                .priceMax(new BigDecimal("110.00"))
                .listingPrice(new BigDecimal("135.00"))
                .listingGainPct(new BigDecimal("22.73"))
                .gmp(new BigDecimal("25.00"))
                .gmpPct(new BigDecimal("22.73"))
                .subTotal(new BigDecimal("15.50"))
                .lotSize(130)
                .issueSize("500 Cr")
                .listingExchange("NSE")
                .allotmentStatus("finalized")
                .registrar("Link Intime")
                .registrarUrl("https://linkintime.co.in/acme")
                .firstSeenAt(Instant.parse("2026-07-01T00:00:00Z"))
                .lastSeenAt(Instant.parse("2026-07-24T00:00:00Z"))
                .build();
    }

    @Test
    void toSummary_mapsAllFields() {
        IpoSummaryDto dto = mapper.toSummary(fullListing());

        assertThat(dto.id()).isEqualTo("ipo-1");
        assertThat(dto.companyName()).isEqualTo("Acme Corp");
        assertThat(dto.ipoType()).isEqualTo("mainboard");
        assertThat(dto.status()).isEqualTo("open");
        assertThat(dto.openDate()).isEqualTo(LocalDate.of(2026, 7, 20));
        assertThat(dto.closeDate()).isEqualTo(LocalDate.of(2026, 7, 24));
        assertThat(dto.listingDate()).isEqualTo(LocalDate.of(2026, 7, 30));
        assertThat(dto.priceMin()).isEqualByComparingTo("100.00");
        assertThat(dto.priceMax()).isEqualByComparingTo("110.00");
        assertThat(dto.gmp()).isEqualByComparingTo("25.00");
        assertThat(dto.gmpPct()).isEqualByComparingTo("22.73");
        assertThat(dto.listingExchange()).isEqualTo("NSE");
        assertThat(dto.listingGainPct()).isEqualByComparingTo("22.73");
        assertThat(dto.allotmentStatus()).isEqualTo("finalized");
    }

    @Test
    void toDetail_mapsAllFields() {
        IpoDetailDto dto = mapper.toDetail(fullListing());

        assertThat(dto.id()).isEqualTo("ipo-1");
        assertThat(dto.companyName()).isEqualTo("Acme Corp");
        assertThat(dto.ipoType()).isEqualTo("mainboard");
        assertThat(dto.status()).isEqualTo("open");
        assertThat(dto.openDate()).isEqualTo(LocalDate.of(2026, 7, 20));
        assertThat(dto.closeDate()).isEqualTo(LocalDate.of(2026, 7, 24));
        assertThat(dto.allotmentDate()).isEqualTo(LocalDate.of(2026, 7, 28));
        assertThat(dto.listingDate()).isEqualTo(LocalDate.of(2026, 7, 30));
        assertThat(dto.priceMin()).isEqualByComparingTo("100.00");
        assertThat(dto.priceMax()).isEqualByComparingTo("110.00");
        assertThat(dto.listingPrice()).isEqualByComparingTo("135.00");
        assertThat(dto.listingGainPct()).isEqualByComparingTo("22.73");
        assertThat(dto.gmp()).isEqualByComparingTo("25.00");
        assertThat(dto.gmpPct()).isEqualByComparingTo("22.73");
        assertThat(dto.subTotal()).isEqualByComparingTo("15.50");
        assertThat(dto.lotSize()).isEqualTo(130);
        assertThat(dto.issueSize()).isEqualTo("500 Cr");
        assertThat(dto.listingExchange()).isEqualTo("NSE");
        assertThat(dto.allotmentStatus()).isEqualTo("finalized");
        assertThat(dto.registrar()).isEqualTo("Link Intime");
        assertThat(dto.registrarUrl()).isEqualTo("https://linkintime.co.in/acme");
    }

    @Test
    void toGmpPoint_mapsAllFields() {
        IpoGmpHistoryEntity entity = IpoGmpHistoryEntity.builder()
                .id("gmp-1")
                .ipoId("ipo-1")
                .gmp(new BigDecimal("25.00"))
                .gmpPct(new BigDecimal("22.73"))
                .source("ipoguru")
                .capturedAt(Instant.parse("2026-07-22T10:00:00Z"))
                .build();

        GmpPointDto dto = mapper.toGmpPoint(entity);

        assertThat(dto.t()).isEqualTo(Instant.parse("2026-07-22T10:00:00Z"));
        assertThat(dto.gmp()).isEqualByComparingTo("25.00");
        assertThat(dto.gmpPct()).isEqualByComparingTo("22.73");
    }

    @Test
    void toSubscriptionPoint_mapsAllFields() {
        IpoSubscriptionHistoryEntity entity = IpoSubscriptionHistoryEntity.builder()
                .id("sub-1")
                .ipoId("ipo-1")
                .qib(new BigDecimal("5.00"))
                .nii(new BigDecimal("10.00"))
                .retail(new BigDecimal("2.50"))
                .total(new BigDecimal("6.75"))
                .source("chittorgarh")
                .capturedAt(Instant.parse("2026-07-23T09:30:00Z"))
                .build();

        SubscriptionPointDto dto = mapper.toSubscriptionPoint(entity);

        assertThat(dto.t()).isEqualTo(Instant.parse("2026-07-23T09:30:00Z"));
        assertThat(dto.qib()).isEqualByComparingTo("5.00");
        assertThat(dto.nii()).isEqualByComparingTo("10.00");
        assertThat(dto.retail()).isEqualByComparingTo("2.50");
        assertThat(dto.total()).isEqualByComparingTo("6.75");
    }

    @Test
    void toChangeDto_mapsAllFields() {
        IpoChangeEventEntity entity = IpoChangeEventEntity.builder()
                .id("evt-1")
                .ipoId("ipo-1")
                .eventType("GMP_JUMP")
                .oldValue("20.00")
                .newValue("25.00")
                .createdAt(Instant.parse("2026-07-22T11:00:00Z"))
                .build();

        IpoChangeDto dto = mapper.toChangeDto(entity);

        assertThat(dto.ipoId()).isEqualTo("ipo-1");
        assertThat(dto.eventType()).isEqualTo("GMP_JUMP");
        assertThat(dto.oldValue()).isEqualTo("20.00");
        assertThat(dto.newValue()).isEqualTo("25.00");
        assertThat(dto.createdAt()).isEqualTo(Instant.parse("2026-07-22T11:00:00Z"));
    }

    @Test
    void toSourceHealth_mapsAllFields() {
        IpoSourcePollEntity entity = IpoSourcePollEntity.builder()
                .source("ipoguru")
                .lastPolledAt(Instant.parse("2026-07-24T06:00:00Z"))
                .lastSuccessAt(Instant.parse("2026-07-24T06:00:00Z"))
                .lastStatus("OK")
                .consecutiveFailures(0)
                .build();

        SourceHealthDto dto = mapper.toSourceHealth(entity);

        assertThat(dto.source()).isEqualTo("ipoguru");
        assertThat(dto.lastPolledAt()).isEqualTo(Instant.parse("2026-07-24T06:00:00Z"));
        assertThat(dto.lastSuccessAt()).isEqualTo(Instant.parse("2026-07-24T06:00:00Z"));
        assertThat(dto.lastStatus()).isEqualTo("OK");
        assertThat(dto.consecutiveFailures()).isZero();
    }
}
