package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.dto.IpoDto;
import com.db.dbworld.app.ipo.dto.IpoFinancialRowDto;
import com.db.dbworld.app.ipo.entity.IpoChangeEventEntity;
import com.db.dbworld.app.ipo.entity.IpoFinancialEntity;
import com.db.dbworld.app.ipo.entity.IpoGmpHistoryEntity;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.entity.IpoSubscriptionHistoryEntity;
import com.db.dbworld.app.ipo.mapper.IpoMapper;
import com.db.dbworld.app.ipo.repository.IpoChangeEventRepository;
import com.db.dbworld.app.ipo.repository.IpoFinancialRepository;
import com.db.dbworld.app.ipo.repository.IpoGmpHistoryRepository;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.app.ipo.repository.IpoSubscriptionHistoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class IpoIngestServiceTest {

    private static final String MATCH_KEY = "acme corp|2026-07-20";
    private static final Instant NOW = Instant.parse("2026-07-24T10:00:00Z");

    IpoListingRepository listingRepo;
    IpoGmpHistoryRepository gmpHistoryRepo;
    IpoSubscriptionHistoryRepository subHistoryRepo;
    IpoChangeEventRepository changeEventRepo;
    IpoFinancialRepository financialRepo;
    IpoIngestService service;

    @BeforeEach
    void setUp() {
        listingRepo = mock(IpoListingRepository.class);
        gmpHistoryRepo = mock(IpoGmpHistoryRepository.class);
        subHistoryRepo = mock(IpoSubscriptionHistoryRepository.class);
        changeEventRepo = mock(IpoChangeEventRepository.class);
        financialRepo = mock(IpoFinancialRepository.class);
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        service = new IpoIngestService(listingRepo, gmpHistoryRepo, subHistoryRepo, changeEventRepo,
                financialRepo, new IpoMapper(), clock);

        when(listingRepo.save(any())).thenAnswer(inv -> {
            IpoListingEntity e = inv.getArgument(0);
            if (e.getId() == null) {
                e.setId("ipo-1");
            }
            return e;
        });
        when(changeEventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(gmpHistoryRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(subHistoryRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(financialRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(financialRepo.findByIpoIdAndFiscalYear(any(), any())).thenReturn(Optional.empty());
        when(financialRepo.findByIpoIdOrderByPeriodEndAsc(any())).thenReturn(List.of());
    }

    /** Fixed category map reused by the dto builders below (order-preserving, matches the real shape a source reports). */
    private static Map<String, BigDecimal> subscriptionCategories() {
        Map<String, BigDecimal> categories = new LinkedHashMap<>();
        categories.put("QIB", new BigDecimal("5.00"));
        categories.put("NII", new BigDecimal("10.00"));
        categories.put("Retail", new BigDecimal("2.50"));
        return categories;
    }

    /** A merged dto (already carries matchKey) with every dimension the tests vary as a parameter. */
    private IpoDto dto(String status, BigDecimal gmp, BigDecimal gmpPct, BigDecimal subTotal, String allotmentStatus,
                        String listingExchange, BigDecimal listingGainPct, BigDecimal listingPrice) {
        return new IpoDto("ipoguru", MATCH_KEY, "Acme Corp", "mainboard", status,
                LocalDate.of(2026, 7, 20), LocalDate.of(2026, 7, 24), LocalDate.of(2026, 7, 28), LocalDate.of(2026, 7, 30),
                new BigDecimal("100.00"), new BigDecimal("110.00"), 130, "500 Cr",
                listingExchange, listingPrice, listingGainPct,
                gmp, gmpPct, subscriptionCategories(), subTotal,
                allotmentStatus, "Link Intime", "https://registrar", null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null);
    }

    /** Returns a copy of {@code dto} with {@code financials} swapped in — mirrors {@code IpoNormalizer.withMatchKey}. */
    private static IpoDto withFinancials(IpoDto dto, List<IpoFinancialRowDto> financials) {
        return new IpoDto(dto.source(), dto.matchKey(), dto.companyName(), dto.ipoType(), dto.status(),
                dto.openDate(), dto.closeDate(), dto.allotmentDate(), dto.listingDate(),
                dto.priceMin(), dto.priceMax(), dto.lotSize(), dto.issueSize(),
                dto.listingExchange(), dto.listingPrice(), dto.listingGainPct(),
                dto.gmp(), dto.gmpPct(), dto.subscriptionCategories(), dto.subTotal(),
                dto.allotmentStatus(), dto.registrar(), dto.registrarUrl(), dto.logoUrl(), dto.about(),
                dto.refundDate(), dto.dematDate(), dto.faceValue(), dto.freshIssue(), dto.offerForSale(),
                dto.tickerSymbol(), dto.strengths(), dto.risks(), financials, null, null, null, null);
    }

    /** A minimal dto with just {@code ipoType} varied, for the type-canonicalization tests. */
    private IpoDto dtoWithType(String ipoType) {
        return new IpoDto("ipoguru", MATCH_KEY, "Acme Corp", ipoType, "open",
                LocalDate.of(2026, 7, 20), LocalDate.of(2026, 7, 24), LocalDate.of(2026, 7, 28), LocalDate.of(2026, 7, 30),
                new BigDecimal("100.00"), new BigDecimal("110.00"), 130, "500 Cr",
                null, null, null,
                new BigDecimal("20.00"), new BigDecimal("18.00"), subscriptionCategories(), new BigDecimal("1.50"),
                "awaited", "Link Intime", "https://registrar", null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null);
    }

    @Test
    void ingest_derivesStatusFromDatesWhenSourceReportsNone() {
        when(listingRepo.findByMatchKey(MATCH_KEY)).thenReturn(Optional.empty());
        // A Chittorgarh-style dto: dates but no status. Today (fixed clock) is 2026-07-24 IST,
        // inside the 20–28 Jul window → should be derived as "open" rather than left null.
        IpoDto noStatus = new IpoDto("chittorgarh", MATCH_KEY, "Acme Corp", "mainboard", null,
                LocalDate.of(2026, 7, 20), LocalDate.of(2026, 7, 28), null, LocalDate.of(2026, 7, 30),
                null, null, null, null, null, null, null,
                null, null, null, null,
                null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null);

        service.ingest(List.of(noStatus));

        ArgumentCaptor<IpoListingEntity> captor = ArgumentCaptor.forClass(IpoListingEntity.class);
        verify(listingRepo).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo("open");
    }

    /** The DB row that mirrors a prior ingest of {@code dto(...)} with the same field values. */
    private IpoListingEntity existingEntity(String status, BigDecimal gmp, BigDecimal gmpPct, BigDecimal subTotal,
                                             String allotmentStatus, String listingExchange, BigDecimal listingGainPct,
                                             BigDecimal listingPrice) {
        return IpoListingEntity.builder()
                .id("ipo-1")
                .matchKey(MATCH_KEY)
                .companyName("Acme Corp")
                .ipoType("mainboard")
                .status(status)
                .openDate(LocalDate.of(2026, 7, 20))
                .closeDate(LocalDate.of(2026, 7, 24))
                .allotmentDate(LocalDate.of(2026, 7, 28))
                .listingDate(LocalDate.of(2026, 7, 30))
                .priceMin(new BigDecimal("100.00"))
                .priceMax(new BigDecimal("110.00"))
                .lotSize(130)
                .issueSize("500 Cr")
                .listingExchange(listingExchange)
                .listingPrice(listingPrice)
                .listingGainPct(listingGainPct)
                .gmp(gmp)
                .gmpPct(gmpPct)
                .subTotal(subTotal)
                .allotmentStatus(allotmentStatus)
                .registrar("Link Intime")
                .registrarUrl("https://registrar")
                .firstSeenAt(Instant.parse("2026-07-01T00:00:00Z"))
                .lastSeenAt(Instant.parse("2026-07-23T00:00:00Z"))
                .build();
    }

    private void stubNoExisting() {
        when(listingRepo.findByMatchKey(MATCH_KEY)).thenReturn(Optional.empty());
        when(gmpHistoryRepo.findTopByIpoIdOrderByCapturedAtDesc(any())).thenReturn(Optional.empty());
        when(subHistoryRepo.findTopByIpoIdOrderByCapturedAtDesc(any())).thenReturn(Optional.empty());
    }

    private void stubExisting(IpoListingEntity existing) {
        when(listingRepo.findByMatchKey(MATCH_KEY)).thenReturn(Optional.of(existing));
        when(gmpHistoryRepo.findTopByIpoIdOrderByCapturedAtDesc("ipo-1"))
                .thenReturn(existing.getGmp() == null ? Optional.empty()
                        : Optional.of(IpoGmpHistoryEntity.builder().gmp(existing.getGmp()).build()));
        when(subHistoryRepo.findTopByIpoIdOrderByCapturedAtDesc("ipo-1"))
                .thenReturn(existing.getSubTotal() == null ? Optional.empty()
                        : Optional.of(IpoSubscriptionHistoryEntity.builder().total(existing.getSubTotal()).build()));
    }

    @Test
    void ingest_newIpo_savesEntityEmitsNewEventAndSeedsHistory() {
        stubNoExisting();
        IpoDto dto = dto("upcoming", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "awaited", null, null, null);

        service.ingest(List.of(dto));

        ArgumentCaptor<IpoListingEntity> listingCaptor = ArgumentCaptor.forClass(IpoListingEntity.class);
        verify(listingRepo, times(1)).save(listingCaptor.capture());
        IpoListingEntity saved = listingCaptor.getValue();
        assertThat(saved.getCompanyName()).isEqualTo("Acme Corp");
        assertThat(saved.getMatchKey()).isEqualTo(MATCH_KEY);
        assertThat(saved.getFirstSeenAt()).isEqualTo(NOW);
        assertThat(saved.getLastSeenAt()).isEqualTo(NOW);

        ArgumentCaptor<IpoChangeEventEntity> eventCaptor = ArgumentCaptor.forClass(IpoChangeEventEntity.class);
        verify(changeEventRepo, times(1)).save(eventCaptor.capture());
        assertThat(eventCaptor.getValue().getEventType()).isEqualTo("NEW");
        assertThat(eventCaptor.getValue().getOldValue()).isNull();
        assertThat(eventCaptor.getValue().getNewValue()).isEqualTo("Acme Corp");

        verify(gmpHistoryRepo, times(1)).save(any());
        // Subscription history is investorgain-owned now — ingest never writes it (see appendHistory).
        verify(subHistoryRepo, never()).save(any());
    }

    @Test
    void ingest_unchangedReingest_emitsNoEventsAndNoNewHistory() {
        IpoListingEntity existing = existingEntity("open", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "awaited", null, null, null);
        stubExisting(existing);
        IpoDto dto = dto("open", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "awaited", null, null, null);

        service.ingest(List.of(dto));

        verify(listingRepo, times(1)).save(any()); // lastSeenAt bump only — acceptable
        verify(changeEventRepo, never()).save(any());
        verify(gmpHistoryRepo, never()).save(any());
        verify(subHistoryRepo, never()).save(any());
    }

    @Test
    void ingest_statusChangeUpcomingToOpen_emitsStatusEventOnly() {
        IpoListingEntity existing = existingEntity("upcoming", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "awaited", null, null, null);
        stubExisting(existing);
        IpoDto dto = dto("open", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "awaited", null, null, null);

        service.ingest(List.of(dto));

        ArgumentCaptor<IpoChangeEventEntity> eventCaptor = ArgumentCaptor.forClass(IpoChangeEventEntity.class);
        verify(changeEventRepo, times(1)).save(eventCaptor.capture());
        IpoChangeEventEntity event = eventCaptor.getValue();
        assertThat(event.getEventType()).isEqualTo("STATUS");
        assertThat(event.getOldValue()).isEqualTo("upcoming");
        assertThat(event.getNewValue()).isEqualTo("open");
    }

    @Test
    void ingest_gmpChange_emitsGmpEventAndHistoryRowButNotSubscription() {
        IpoListingEntity existing = existingEntity("open", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "awaited", null, null, null);
        stubExisting(existing);
        IpoDto dto = dto("open", new BigDecimal("30.00"), new BigDecimal("25.00"),
                new BigDecimal("1.50"), "awaited", null, null, null);

        service.ingest(List.of(dto));

        ArgumentCaptor<IpoChangeEventEntity> eventCaptor = ArgumentCaptor.forClass(IpoChangeEventEntity.class);
        verify(changeEventRepo, times(1)).save(eventCaptor.capture());
        IpoChangeEventEntity event = eventCaptor.getValue();
        assertThat(event.getEventType()).isEqualTo("GMP");
        assertThat(event.getOldValue()).isEqualTo("20.00");
        assertThat(event.getNewValue()).isEqualTo("30.00");

        verify(gmpHistoryRepo, times(1)).save(any());
        verify(subHistoryRepo, never()).save(any());
    }

    @Test
    void ingest_allotmentStatusChangeAwaitedToFinalized_emitsAllotmentEvent() {
        IpoListingEntity existing = existingEntity("open", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "awaited", null, null, null);
        stubExisting(existing);
        IpoDto dto = dto("open", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "finalized", null, null, null);

        service.ingest(List.of(dto));

        ArgumentCaptor<IpoChangeEventEntity> eventCaptor = ArgumentCaptor.forClass(IpoChangeEventEntity.class);
        verify(changeEventRepo, times(1)).save(eventCaptor.capture());
        IpoChangeEventEntity event = eventCaptor.getValue();
        assertThat(event.getEventType()).isEqualTo("ALLOTMENT");
        assertThat(event.getOldValue()).isEqualTo("awaited");
        assertThat(event.getNewValue()).isEqualTo("finalized");
    }

    @Test
    void ingest_statusTransitionsToListed_emitsListingEvent() {
        IpoListingEntity existing = existingEntity("open", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "finalized", null, null, null);
        stubExisting(existing);
        IpoDto dto = dto("listed", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "finalized", "NSE", new BigDecimal("22.73"), new BigDecimal("135.00"));

        service.ingest(List.of(dto));

        ArgumentCaptor<IpoChangeEventEntity> eventCaptor = ArgumentCaptor.forClass(IpoChangeEventEntity.class);
        verify(changeEventRepo, times(2)).save(eventCaptor.capture()); // STATUS (open->listed) + LISTING
        List<IpoChangeEventEntity> events = eventCaptor.getAllValues();
        assertThat(events).extracting(IpoChangeEventEntity::getEventType).containsExactlyInAnyOrder("STATUS", "LISTING");

        IpoChangeEventEntity listingEvent = events.stream()
                .filter(e -> "LISTING".equals(e.getEventType())).findFirst().orElseThrow();
        assertThat(listingEvent.getNewValue()).isEqualTo("NSE 22.73%");
    }

    @Test
    void ingest_statusTransitionsToListedWithNullExchangeAndGainPct_listingEventValueSkipsNulls() {
        IpoListingEntity existing = existingEntity("open", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "finalized", null, null, null);
        stubExisting(existing);
        IpoDto dto = dto("listed", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "finalized", null, null, null);

        service.ingest(List.of(dto));

        ArgumentCaptor<IpoChangeEventEntity> eventCaptor = ArgumentCaptor.forClass(IpoChangeEventEntity.class);
        verify(changeEventRepo, times(2)).save(eventCaptor.capture()); // STATUS (open->listed) + LISTING
        IpoChangeEventEntity listingEvent = eventCaptor.getAllValues().stream()
                .filter(e -> "LISTING".equals(e.getEventType())).findFirst().orElseThrow();
        assertThat(listingEvent.getNewValue()).isEmpty();
    }

    @Test
    void ingest_listingPriceNewlySetWithoutStatusChange_stillEmitsListingEvent() {
        IpoListingEntity existing = existingEntity("listed", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "finalized", null, null, null); // status already "listed", price not yet known
        stubExisting(existing);
        IpoDto dto = dto("listed", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "finalized", "NSE", new BigDecimal("22.73"), new BigDecimal("135.00"));

        service.ingest(List.of(dto));

        ArgumentCaptor<IpoChangeEventEntity> eventCaptor = ArgumentCaptor.forClass(IpoChangeEventEntity.class);
        verify(changeEventRepo, times(1)).save(eventCaptor.capture());
        assertThat(eventCaptor.getValue().getEventType()).isEqualTo("LISTING");
    }

    @Test
    void ingest_alreadyListedReingestedWithIdenticalListedDto_emitsNoListingEventOrNewHistory() {
        // Entity has already completed the listed transition (status + listingPrice both set);
        // re-ingesting the same listed dto must not re-fire LISTING or append fresh history rows.
        IpoListingEntity existing = existingEntity("listed", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "finalized", "NSE", new BigDecimal("22.73"), new BigDecimal("135.00"));
        stubExisting(existing);
        IpoDto dto = dto("listed", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "finalized", "NSE", new BigDecimal("22.73"), new BigDecimal("135.00"));

        service.ingest(List.of(dto));

        verify(listingRepo, times(1)).save(any()); // lastSeenAt bump only — acceptable
        verify(changeEventRepo, never()).save(any());
        verify(gmpHistoryRepo, never()).save(any());
        verify(subHistoryRepo, never()).save(any());
    }

    @Test
    void ingest_sourceReportsActive_storesCanonicalOpenStatus() {
        stubNoExisting();
        IpoDto dto = dto("Active", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "awaited", null, null, null);

        service.ingest(List.of(dto));

        ArgumentCaptor<IpoListingEntity> listingCaptor = ArgumentCaptor.forClass(IpoListingEntity.class);
        verify(listingRepo, times(1)).save(listingCaptor.capture());
        assertThat(listingCaptor.getValue().getStatus()).isEqualTo("open");
    }

    @Test
    void ingest_sourceReportsListedRawCasing_canonicalizesAndTriggersListingTransition() {
        IpoListingEntity existing = existingEntity("open", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "finalized", null, null, null);
        stubExisting(existing);
        // Source reports "Listed" (NSE-style casing) rather than the already-canonical "listed".
        IpoDto dto = dto("Listed", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "finalized", "NSE", new BigDecimal("22.73"), new BigDecimal("135.00"));

        service.ingest(List.of(dto));

        ArgumentCaptor<IpoChangeEventEntity> eventCaptor = ArgumentCaptor.forClass(IpoChangeEventEntity.class);
        verify(changeEventRepo, times(2)).save(eventCaptor.capture()); // STATUS (open->listed) + LISTING
        List<IpoChangeEventEntity> events = eventCaptor.getAllValues();
        assertThat(events).extracting(IpoChangeEventEntity::getEventType).containsExactlyInAnyOrder("STATUS", "LISTING");

        IpoChangeEventEntity statusEvent = events.stream()
                .filter(e -> "STATUS".equals(e.getEventType())).findFirst().orElseThrow();
        assertThat(statusEvent.getOldValue()).isEqualTo("open");
        assertThat(statusEvent.getNewValue()).isEqualTo("listed"); // canonicalized, not raw "Listed"

        ArgumentCaptor<IpoListingEntity> listingCaptor = ArgumentCaptor.forClass(IpoListingEntity.class);
        verify(listingRepo, times(1)).save(listingCaptor.capture());
        assertThat(listingCaptor.getValue().getStatus()).isEqualTo("listed");
    }

    @Test
    void ingest_nullGmpInDto_doesNotEmitEventOrWipeExistingGmp() {
        IpoListingEntity existing = existingEntity("open", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "awaited", null, null, null);
        stubExisting(existing);
        // source didn't report gmp this round
        IpoDto dto = dto("open", null, null, new BigDecimal("1.50"), "awaited", null, null, null);

        service.ingest(List.of(dto));

        verify(changeEventRepo, never()).save(any());
        verify(gmpHistoryRepo, never()).save(any());

        ArgumentCaptor<IpoListingEntity> listingCaptor = ArgumentCaptor.forClass(IpoListingEntity.class);
        verify(listingRepo, times(1)).save(listingCaptor.capture());
        assertThat(listingCaptor.getValue().getGmp()).isEqualByComparingTo("20.00"); // not wiped
    }

    @Test
    void ingest_sourceReportsMainBoardVariant_storesCanonicalMainboardType() {
        stubNoExisting();
        IpoDto dto = dtoWithType("Main Board");

        service.ingest(List.of(dto));

        ArgumentCaptor<IpoListingEntity> listingCaptor = ArgumentCaptor.forClass(IpoListingEntity.class);
        verify(listingRepo, times(1)).save(listingCaptor.capture());
        assertThat(listingCaptor.getValue().getIpoType()).isEqualTo("mainboard");
    }

    // ── Financials UPSERT (Unit 3) ──────────────────────────────────────────────────────────────

    @Test
    void ingest_newIpoWithFinancials_insertsARowPerFiscalYear() {
        stubNoExisting();
        IpoDto dto = withFinancials(
                dto("upcoming", new BigDecimal("20.00"), new BigDecimal("18.00"),
                        new BigDecimal("1.50"), "awaited", null, null, null),
                List.of(
                        new IpoFinancialRowDto("FY 2023-24", LocalDate.of(2024, 3, 31),
                                new BigDecimal("100.00"), new BigDecimal("10.00"), new BigDecimal("500.00")),
                        new IpoFinancialRowDto("FY 2024-25", LocalDate.of(2025, 3, 31),
                                new BigDecimal("150.00"), new BigDecimal("20.00"), new BigDecimal("600.00"))));

        service.ingest(List.of(dto));

        ArgumentCaptor<IpoFinancialEntity> captor = ArgumentCaptor.forClass(IpoFinancialEntity.class);
        verify(financialRepo, times(2)).save(captor.capture());
        assertThat(captor.getAllValues()).extracting(IpoFinancialEntity::getFiscalYear)
                .containsExactlyInAnyOrder("FY 2023-24", "FY 2024-25");
        assertThat(captor.getAllValues()).allSatisfy(e -> assertThat(e.getIpoId()).isEqualTo("ipo-1"));
    }

    @Test
    void ingest_reingestIdenticalFinancials_isANoOp() {
        IpoListingEntity existing = existingEntity("open", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "awaited", null, null, null);
        stubExisting(existing);
        IpoFinancialEntity existingFinancial = IpoFinancialEntity.builder()
                .id("fin-1").ipoId("ipo-1").fiscalYear("FY 2023-24")
                .revenue(new BigDecimal("100.00")).pat(new BigDecimal("10.00")).totalAssets(new BigDecimal("500.00"))
                .periodEnd(LocalDate.of(2024, 3, 31))
                .build();
        when(financialRepo.findByIpoIdAndFiscalYear("ipo-1", "FY 2023-24")).thenReturn(Optional.of(existingFinancial));

        IpoDto dto = withFinancials(
                dto("open", new BigDecimal("20.00"), new BigDecimal("18.00"),
                        new BigDecimal("1.50"), "awaited", null, null, null),
                List.of(new IpoFinancialRowDto("FY 2023-24", LocalDate.of(2024, 3, 31),
                        new BigDecimal("100.00"), new BigDecimal("10.00"), new BigDecimal("500.00"))));

        service.ingest(List.of(dto));

        verify(financialRepo, never()).save(any());
    }

    @Test
    void ingest_existingFinancialRowWithChangedFigure_updatesInPlaceRatherThanInserting() {
        IpoListingEntity existing = existingEntity("open", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "awaited", null, null, null);
        stubExisting(existing);
        IpoFinancialEntity existingFinancial = IpoFinancialEntity.builder()
                .id("fin-1").ipoId("ipo-1").fiscalYear("FY 2023-24")
                .revenue(new BigDecimal("100.00")).pat(new BigDecimal("10.00")).totalAssets(new BigDecimal("500.00"))
                .periodEnd(LocalDate.of(2024, 3, 31))
                .build();
        when(financialRepo.findByIpoIdAndFiscalYear("ipo-1", "FY 2023-24")).thenReturn(Optional.of(existingFinancial));

        IpoDto dto = withFinancials(
                dto("open", new BigDecimal("20.00"), new BigDecimal("18.00"),
                        new BigDecimal("1.50"), "awaited", null, null, null),
                List.of(new IpoFinancialRowDto("FY 2023-24", LocalDate.of(2024, 3, 31),
                        new BigDecimal("120.00"), new BigDecimal("10.00"), new BigDecimal("500.00"))));

        service.ingest(List.of(dto));

        ArgumentCaptor<IpoFinancialEntity> captor = ArgumentCaptor.forClass(IpoFinancialEntity.class);
        verify(financialRepo, times(1)).save(captor.capture());
        assertThat(captor.getValue().getId()).isEqualTo("fin-1"); // updated in place, not re-inserted
        assertThat(captor.getValue().getRevenue()).isEqualByComparingTo("120.00");
    }

    @Test
    void ingest_financialsReconcile_dropsStaleFiscalYearsNoLongerReported() {
        stubNoExisting();
        // The DB already has a stale row (a metric label mis-stored as a "period" by an earlier
        // parse) alongside a real fiscal year. The fresh scrape reports only the real year, so the
        // stale row must be deleted and the real one kept.
        IpoFinancialEntity stale = IpoFinancialEntity.builder()
                .id("fin-stale").ipoId("ipo-1").fiscalYear("Assets").build();
        IpoFinancialEntity real = IpoFinancialEntity.builder()
                .id("fin-24").ipoId("ipo-1").fiscalYear("FY 2023-24")
                .revenue(new BigDecimal("100.00")).pat(new BigDecimal("10.00")).totalAssets(new BigDecimal("500.00"))
                .periodEnd(LocalDate.of(2024, 3, 31)).build();
        when(financialRepo.findByIpoIdOrderByPeriodEndAsc("ipo-1")).thenReturn(List.of(stale, real));
        when(financialRepo.findByIpoIdAndFiscalYear("ipo-1", "FY 2023-24")).thenReturn(Optional.of(real));

        IpoDto dto = withFinancials(
                dto("open", new BigDecimal("20.00"), new BigDecimal("18.00"),
                        new BigDecimal("1.50"), "awaited", null, null, null),
                List.of(new IpoFinancialRowDto("FY 2023-24", LocalDate.of(2024, 3, 31),
                        new BigDecimal("100.00"), new BigDecimal("10.00"), new BigDecimal("500.00"))));

        service.ingest(List.of(dto));

        verify(financialRepo).delete(stale);
        verify(financialRepo, never()).delete(real);
    }

    @Test
    void ingest_dtoWithNoFinancials_neverTouchesFinancialRepo() {
        stubNoExisting();
        IpoDto dto = dto("upcoming", new BigDecimal("20.00"), new BigDecimal("18.00"),
                new BigDecimal("1.50"), "awaited", null, null, null); // financials null by default

        service.ingest(List.of(dto));

        verify(financialRepo, never()).findByIpoIdAndFiscalYear(any(), any());
        verify(financialRepo, never()).save(any());
    }

    @Test
    void ingest_sourceReportsNseEmergeVariant_storesCanonicalSmeType() {
        stubNoExisting();
        IpoDto dto = dtoWithType("NSE Emerge");

        service.ingest(List.of(dto));

        ArgumentCaptor<IpoListingEntity> listingCaptor = ArgumentCaptor.forClass(IpoListingEntity.class);
        verify(listingRepo, times(1)).save(listingCaptor.capture());
        assertThat(listingCaptor.getValue().getIpoType()).isEqualTo("sme");
    }
}
