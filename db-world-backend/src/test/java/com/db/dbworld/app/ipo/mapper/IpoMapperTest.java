package com.db.dbworld.app.ipo.mapper;

import com.db.dbworld.app.ipo.dto.*;
import com.db.dbworld.app.ipo.entity.*;
import com.db.dbworld.app.ipo.service.IpoSubscriptionJson;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

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
                .refundDate(LocalDate.of(2026, 7, 29))
                .dematDate(LocalDate.of(2026, 8, 1))
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
                .logoUrl("https://ui-avatars.com/api/?name=Acme+Corp")
                .about("Acme Corp is a leading widget manufacturer.")
                .faceValue(new BigDecimal("10.00"))
                .freshIssue(new BigDecimal("120.00"))
                .offerForSale(new BigDecimal("80.00"))
                .tickerSymbol("ACME")
                .strengths("Strength one\nStrength two\n\nStrength three  ")
                .risks("Risk one\nRisk two")
                .foundedYear(2010)
                .managingDirector("Jane Founder")
                .parentCompany("Acme Holdings Ltd")
                .sector("Fintech")
                .headquarters("Bengaluru")
                .website("https://www.acmecorp.example")
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
        assertThat(dto.subTotal()).isEqualByComparingTo("15.50");
        assertThat(dto.lotSize()).isEqualTo(130);
        assertThat(dto.listingExchange()).isEqualTo("NSE");
        assertThat(dto.listingGainPct()).isEqualByComparingTo("22.73");
        assertThat(dto.allotmentStatus()).isEqualTo("finalized");
        assertThat(dto.logoUrl()).isEqualTo("https://ui-avatars.com/api/?name=Acme+Corp");
        assertThat(dto.registrarUrl()).isEqualTo("https://linkintime.co.in/acme");
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
        assertThat(dto.logoUrl()).isEqualTo("https://ui-avatars.com/api/?name=Acme+Corp");
        assertThat(dto.about()).isEqualTo("Acme Corp is a leading widget manufacturer.");
        assertThat(dto.refundDate()).isEqualTo(LocalDate.of(2026, 7, 29));
        assertThat(dto.dematDate()).isEqualTo(LocalDate.of(2026, 8, 1));
        assertThat(dto.faceValue()).isEqualByComparingTo("10.00");
        assertThat(dto.freshIssue()).isEqualByComparingTo("120.00");
        assertThat(dto.offerForSale()).isEqualByComparingTo("80.00");
        assertThat(dto.tickerSymbol()).isEqualTo("ACME");
        assertThat(dto.strengths()).containsExactly("Strength one", "Strength two", "Strength three");
        assertThat(dto.risks()).containsExactly("Risk one", "Risk two");
        assertThat(dto.foundedYear()).isEqualTo(2010);
        assertThat(dto.managingDirector()).isEqualTo("Jane Founder");
        assertThat(dto.parentCompany()).isEqualTo("Acme Holdings Ltd");
        assertThat(dto.sector()).isEqualTo("Fintech");
        assertThat(dto.headquarters()).isEqualTo("Bengaluru");
        assertThat(dto.website()).isEqualTo("https://www.acmecorp.example");
    }

    @Test
    void toDetail_aboutFieldsNull_mapToNull() {
        IpoListingEntity entity = fullListing();
        entity.setFoundedYear(null);
        entity.setManagingDirector(null);
        entity.setParentCompany(null);
        entity.setSector(null);
        entity.setHeadquarters(null);
        entity.setWebsite(null);

        IpoDetailDto dto = mapper.toDetail(entity);

        assertThat(dto.foundedYear()).isNull();
        assertThat(dto.managingDirector()).isNull();
        assertThat(dto.parentCompany()).isNull();
        assertThat(dto.sector()).isNull();
        assertThat(dto.headquarters()).isNull();
        assertThat(dto.website()).isNull();
    }

    @Test
    void toDetail_nullStrengthsAndRisks_mapToEmptyLists() {
        IpoListingEntity entity = fullListing();
        entity.setStrengths(null);
        entity.setRisks("   ");

        IpoDetailDto dto = mapper.toDetail(entity);

        assertThat(dto.strengths()).isEmpty();
        assertThat(dto.risks()).isEmpty();
    }

    @Test
    void toFinancial_mapsAllFields() {
        IpoFinancialEntity entity = IpoFinancialEntity.builder()
                .id("fin-1")
                .ipoId("ipo-1")
                .fiscalYear("FY24")
                .revenue(new BigDecimal("500.00"))
                .pat(new BigDecimal("50.00"))
                .totalAssets(new BigDecimal("1200.00"))
                .periodEnd(LocalDate.of(2024, 3, 31))
                .build();

        IpoFinancialDto dto = mapper.toFinancial(entity);

        assertThat(dto.fiscalYear()).isEqualTo("FY24");
        assertThat(dto.revenue()).isEqualByComparingTo("500.00");
        assertThat(dto.pat()).isEqualByComparingTo("50.00");
        assertThat(dto.totalAssets()).isEqualByComparingTo("1200.00");
    }

    @Test
    void toFinancial_nullTotalAssets_mapsToNull() {
        IpoFinancialEntity entity = IpoFinancialEntity.builder()
                .id("fin-1")
                .ipoId("ipo-1")
                .fiscalYear("FY24")
                .revenue(new BigDecimal("500.00"))
                .pat(new BigDecimal("50.00"))
                .periodEnd(LocalDate.of(2024, 3, 31))
                .build();

        IpoFinancialDto dto = mapper.toFinancial(entity);

        assertThat(dto.totalAssets()).isNull();
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
    void toSubscriptionPoint_mapsCategoriesAndDerivesQibNiiRetail() {
        Map<String, BigDecimal> categories = new LinkedHashMap<>();
        categories.put("QIB", new BigDecimal("5.00"));
        categories.put("NII", new BigDecimal("10.00"));
        categories.put("Retail", new BigDecimal("2.50"));
        categories.put("Anchor", new BigDecimal("3.00"));
        IpoSubscriptionHistoryEntity entity = IpoSubscriptionHistoryEntity.builder()
                .id("sub-1")
                .ipoId("ipo-1")
                .categoriesJson(IpoSubscriptionJson.toJson(categories))
                .total(new BigDecimal("6.75"))
                .source("chittorgarh")
                .capturedAt(Instant.parse("2026-07-23T09:30:00Z"))
                .build();

        SubscriptionPointDto dto = mapper.toSubscriptionPoint(entity);

        assertThat(dto.t()).isEqualTo(Instant.parse("2026-07-23T09:30:00Z"));
        assertThat(dto.total()).isEqualByComparingTo("6.75");
        assertThat(dto.categories().keySet()).containsExactly("QIB", "NII", "Retail", "Anchor");
        assertThat(dto.qib()).isEqualByComparingTo("5.00");
        assertThat(dto.nii()).isEqualByComparingTo("10.00");
        assertThat(dto.retail()).isEqualByComparingTo("2.50");
    }

    @Test
    void toSubscriptionPoint_nullCategoriesJson_emptyCategoriesAndNullDerivedFields() {
        IpoSubscriptionHistoryEntity entity = IpoSubscriptionHistoryEntity.builder()
                .id("sub-1")
                .ipoId("ipo-1")
                .total(new BigDecimal("6.75"))
                .capturedAt(Instant.parse("2026-07-23T09:30:00Z"))
                .build();

        SubscriptionPointDto dto = mapper.toSubscriptionPoint(entity);

        assertThat(dto.categories()).isEmpty();
        assertThat(dto.qib()).isNull();
        assertThat(dto.nii()).isNull();
        assertThat(dto.retail()).isNull();
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

    @Test
    void toMyIpoDto_wrapsApplicationWithIpoSummaryIncludingRegistrarUrl() {
        IpoUserApplicationEntity application = IpoUserApplicationEntity.builder()
                .ipoId("ipo-1")
                .applicantName("Jane Doe")
                .applicationNo("APP123")
                .dpClientId("DP456")
                .panLast4("234F")
                .allotmentResult("unknown")
                .build();

        MyIpoDto dto = mapper.toMyIpoDto(application, fullListing());

        assertThat(dto.application().ipoId()).isEqualTo("ipo-1");
        assertThat(dto.application().applicationNo()).isEqualTo("APP123");
        // MyIpoDto wraps a plain IpoSummaryDto, so registrarUrl/lotSize ride along automatically.
        assertThat(dto.ipo().registrarUrl()).isEqualTo("https://linkintime.co.in/acme");
        assertThat(dto.ipo().lotSize()).isEqualTo(130);
    }

    private static Map<String, BigDecimal> sampleCategories() {
        Map<String, BigDecimal> categories = new LinkedHashMap<>();
        categories.put("QIB", new BigDecimal("5.00"));
        categories.put("NII", new BigDecimal("10.00"));
        categories.put("Retail", new BigDecimal("2.50"));
        return categories;
    }

    private IpoDto fullDto() {
        return new IpoDto("nse", "acme-corp|2026-07-20", "Acme Corp", "mainboard", "open",
                LocalDate.of(2026, 7, 20), LocalDate.of(2026, 7, 24), LocalDate.of(2026, 7, 28), LocalDate.of(2026, 7, 30),
                new BigDecimal("100.00"), new BigDecimal("110.00"), 130, "500 Cr",
                "NSE", new BigDecimal("135.00"), new BigDecimal("22.73"),
                new BigDecimal("25.00"), new BigDecimal("22.73"),
                sampleCategories(), new BigDecimal("15.50"),
                "finalized", "Link Intime", "https://linkintime.co.in/acme",
                "https://ui-avatars.com/api/?name=Acme+Corp", "Acme Corp is a leading widget manufacturer.",
                LocalDate.of(2026, 7, 29), LocalDate.of(2026, 8, 1),
                new BigDecimal("10.00"), new BigDecimal("120.00"), new BigDecimal("80.00"),
                "ACME", "Strength one\nStrength two", "Risk one\nRisk two");
    }

    @Test
    void toNewEntity_mapsAllUpdatableFieldsAndMatchKey() {
        IpoListingEntity entity = mapper.toNewEntity(fullDto());

        assertThat(entity.getId()).isNull(); // JPA/DB assigns this on save
        assertThat(entity.getMatchKey()).isEqualTo("acme-corp|2026-07-20");
        assertThat(entity.getCompanyName()).isEqualTo("Acme Corp");
        assertThat(entity.getIpoType()).isEqualTo("mainboard");
        assertThat(entity.getStatus()).isEqualTo("open");
        assertThat(entity.getOpenDate()).isEqualTo(LocalDate.of(2026, 7, 20));
        assertThat(entity.getCloseDate()).isEqualTo(LocalDate.of(2026, 7, 24));
        assertThat(entity.getAllotmentDate()).isEqualTo(LocalDate.of(2026, 7, 28));
        assertThat(entity.getListingDate()).isEqualTo(LocalDate.of(2026, 7, 30));
        assertThat(entity.getPriceMin()).isEqualByComparingTo("100.00");
        assertThat(entity.getPriceMax()).isEqualByComparingTo("110.00");
        assertThat(entity.getListingPrice()).isEqualByComparingTo("135.00");
        assertThat(entity.getListingGainPct()).isEqualByComparingTo("22.73");
        assertThat(entity.getGmp()).isEqualByComparingTo("25.00");
        assertThat(entity.getGmpPct()).isEqualByComparingTo("22.73");
        assertThat(entity.getSubTotal()).isEqualByComparingTo("15.50");
        assertThat(entity.getLotSize()).isEqualTo(130);
        assertThat(entity.getIssueSize()).isEqualTo("500 Cr");
        assertThat(entity.getListingExchange()).isEqualTo("NSE");
        assertThat(entity.getAllotmentStatus()).isEqualTo("finalized");
        assertThat(entity.getRegistrar()).isEqualTo("Link Intime");
        assertThat(entity.getRegistrarUrl()).isEqualTo("https://linkintime.co.in/acme");
        assertThat(entity.getLogoUrl()).isEqualTo("https://ui-avatars.com/api/?name=Acme+Corp");
        assertThat(entity.getAbout()).isEqualTo("Acme Corp is a leading widget manufacturer.");
        assertThat(entity.getRefundDate()).isEqualTo(LocalDate.of(2026, 7, 29));
        assertThat(entity.getDematDate()).isEqualTo(LocalDate.of(2026, 8, 1));
        assertThat(entity.getFaceValue()).isEqualByComparingTo("10.00");
        assertThat(entity.getFreshIssue()).isEqualByComparingTo("120.00");
        assertThat(entity.getOfferForSale()).isEqualByComparingTo("80.00");
        assertThat(entity.getTickerSymbol()).isEqualTo("ACME");
        assertThat(entity.getStrengths()).isEqualTo("Strength one\nStrength two");
        assertThat(entity.getRisks()).isEqualTo("Risk one\nRisk two");
        // firstSeenAt/lastSeenAt are the ingest service's responsibility, not the mapper's.
        assertThat(entity.getFirstSeenAt()).isNull();
        assertThat(entity.getLastSeenAt()).isNull();
    }

    @Test
    void applyUpdatable_overwritesOnlyNonNullDtoFields() {
        IpoListingEntity entity = fullListing();

        IpoDto partial = new IpoDto("chittorgarh", "acme-corp|2026-07-20", null, null, "listed",
                null, null, null, null,
                null, null, null, null,
                null, null, null,
                null, null, null, null,
                "finalized", null, null, null, null, null, null,
                null, null, null, null, null, null);

        mapper.applyUpdatable(partial, entity);

        // overwritten because dto supplied a non-null value
        assertThat(entity.getStatus()).isEqualTo("listed");
        assertThat(entity.getAllotmentStatus()).isEqualTo("finalized");

        // preserved because dto's value was null (source didn't report it this round)
        assertThat(entity.getCompanyName()).isEqualTo("Acme Corp");
        assertThat(entity.getGmp()).isEqualByComparingTo("25.00");
        assertThat(entity.getSubTotal()).isEqualByComparingTo("15.50");
        assertThat(entity.getRegistrar()).isEqualTo("Link Intime");
        assertThat(entity.getListingExchange()).isEqualTo("NSE");
        assertThat(entity.getLogoUrl()).isEqualTo("https://ui-avatars.com/api/?name=Acme+Corp");
        assertThat(entity.getAbout()).isEqualTo("Acme Corp is a leading widget manufacturer.");
        assertThat(entity.getRefundDate()).isEqualTo(LocalDate.of(2026, 7, 29));
        assertThat(entity.getDematDate()).isEqualTo(LocalDate.of(2026, 8, 1));
        assertThat(entity.getFaceValue()).isEqualByComparingTo("10.00");
        assertThat(entity.getFreshIssue()).isEqualByComparingTo("120.00");
        assertThat(entity.getOfferForSale()).isEqualByComparingTo("80.00");
        assertThat(entity.getTickerSymbol()).isEqualTo("ACME");
        assertThat(entity.getStrengths()).isEqualTo("Strength one\nStrength two\n\nStrength three  ");
        assertThat(entity.getRisks()).isEqualTo("Risk one\nRisk two");
    }

    @Test
    void applyUpdatable_overwritesNewFieldsWhenProvided() {
        IpoListingEntity entity = fullListing();

        IpoDto withNewValues = new IpoDto("chittorgarh", "acme-corp|2026-07-20", null, null, null,
                null, null, null, null,
                null, null, null, null,
                null, null, null,
                null, null, null, null,
                null, null, null, null, null, null, null,
                new BigDecimal("5.00"), new BigDecimal("200.00"), new BigDecimal("50.00"),
                "NEWTICK", "New strength", "New risk");

        mapper.applyUpdatable(withNewValues, entity);

        assertThat(entity.getFaceValue()).isEqualByComparingTo("5.00");
        assertThat(entity.getFreshIssue()).isEqualByComparingTo("200.00");
        assertThat(entity.getOfferForSale()).isEqualByComparingTo("50.00");
        assertThat(entity.getTickerSymbol()).isEqualTo("NEWTICK");
        assertThat(entity.getStrengths()).isEqualTo("New strength");
        assertThat(entity.getRisks()).isEqualTo("New risk");
    }

    @Test
    void applyUpdatable_updatesTimelineDatesWhenProvided() {
        IpoListingEntity entity = fullListing();

        IpoDto withNewDates = new IpoDto("chittorgarh", "acme-corp|2026-07-20", null, null, null,
                null, null, null, null,
                null, null, null, null,
                null, null, null,
                null, null, null, null,
                null, null, null, null, null,
                LocalDate.of(2026, 7, 31), LocalDate.of(2026, 8, 3),
                null, null, null, null, null, null);

        mapper.applyUpdatable(withNewDates, entity);

        assertThat(entity.getRefundDate()).isEqualTo(LocalDate.of(2026, 7, 31));
        assertThat(entity.getDematDate()).isEqualTo(LocalDate.of(2026, 8, 3));
    }

    @Test
    void applyUpdatable_doesNotTouchIdOrTimestamps() {
        IpoListingEntity entity = fullListing();
        Instant originalFirstSeen = entity.getFirstSeenAt();
        Instant originalLastSeen = entity.getLastSeenAt();

        mapper.applyUpdatable(fullDto(), entity);

        assertThat(entity.getId()).isEqualTo("ipo-1");
        assertThat(entity.getFirstSeenAt()).isEqualTo(originalFirstSeen);
        assertThat(entity.getLastSeenAt()).isEqualTo(originalLastSeen);
    }
}
