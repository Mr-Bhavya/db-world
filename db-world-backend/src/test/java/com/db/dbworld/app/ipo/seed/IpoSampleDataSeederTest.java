package com.db.dbworld.app.ipo.seed;

import com.db.dbworld.app.ipo.entity.IpoFinancialEntity;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.entity.IpoSubscriptionHistoryEntity;
import com.db.dbworld.app.ipo.repository.IpoFinancialRepository;
import com.db.dbworld.app.ipo.repository.IpoGmpHistoryRepository;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.app.ipo.repository.IpoSubscriptionHistoryRepository;
import com.db.dbworld.app.ipo.service.IpoNormalizer;
import com.db.dbworld.app.ipo.service.IpoSubscriptionJson;
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
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.data.Offset.offset;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class IpoSampleDataSeederTest {

    private static final Instant NOW = Instant.parse("2026-07-24T10:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    IpoListingRepository listingRepository;
    IpoGmpHistoryRepository gmpHistoryRepository;
    IpoSubscriptionHistoryRepository subscriptionHistoryRepository;
    IpoFinancialRepository financialRepository;
    IpoNormalizer normalizer;

    @BeforeEach
    void setUp() {
        listingRepository = mock(IpoListingRepository.class);
        gmpHistoryRepository = mock(IpoGmpHistoryRepository.class);
        subscriptionHistoryRepository = mock(IpoSubscriptionHistoryRepository.class);
        financialRepository = mock(IpoFinancialRepository.class);
        normalizer = new IpoNormalizer();
    }

    private IpoSampleDataSeeder seeder(boolean enabled) {
        return new IpoSampleDataSeeder(listingRepository, gmpHistoryRepository, subscriptionHistoryRepository,
                financialRepository, normalizer, enabled, CLOCK);
    }

    /** Mimics JPA's save() assigning a generated id, like IpoIngestServiceTest does for the same repo. */
    private void stubSaveAssignsId() {
        AtomicInteger counter = new AtomicInteger();
        when(listingRepository.save(any())).thenAnswer(inv -> {
            IpoListingEntity e = inv.getArgument(0);
            e.setId("sample-ipo-" + counter.incrementAndGet());
            return e;
        });
    }

    @Test
    void run_disabled_doesNothingAndNeverEvenChecksTheTable() {
        seeder(false).run(null);

        verify(listingRepository, never()).count();
        verify(listingRepository, never()).save(any());
        verify(financialRepository, never()).save(any());
        verify(gmpHistoryRepository, never()).save(any());
        verify(subscriptionHistoryRepository, never()).save(any());
    }

    @Test
    void run_enabledButTableAlreadyHasData_doesNothing() {
        when(listingRepository.count()).thenReturn(5L);

        seeder(true).run(null);

        verify(listingRepository).count();
        verify(listingRepository, never()).save(any());
        verify(financialRepository, never()).save(any());
        verify(gmpHistoryRepository, never()).save(any());
        verify(subscriptionHistoryRepository, never()).save(any());
    }

    @Test
    void run_enabledAndTableEmpty_seedsListingsFinancialsAndTradingHistory() {
        when(listingRepository.count()).thenReturn(0L);
        stubSaveAssignsId();

        seeder(true).run(null);

        verify(listingRepository, times(8)).save(any());
        verify(financialRepository, times(26)).save(any()); // 6 IPOs x 3 fiscal years + 2 IPOs x (3 + 1 interim row)
        verify(gmpHistoryRepository, times(15)).save(any()); // 5 points x 3 IPOs flagged for trading history
        verify(subscriptionHistoryRepository, times(15)).save(any());
    }

    @Test
    void run_enabledAndTableEmpty_reRunning_isANoOpSecondTime() {
        // First run seeds; simulate the table now having rows for a second boot in the same JVM.
        when(listingRepository.count()).thenReturn(0L).thenReturn(8L);
        stubSaveAssignsId();
        IpoSampleDataSeeder seeder = seeder(true);

        seeder.run(null);
        seeder.run(null);

        verify(listingRepository, times(8)).save(any()); // only from the first run
    }

    @Test
    void run_enabledAndTableEmpty_everyListingGetsAMatchKeyLogoAndSeenTimestamps() {
        when(listingRepository.count()).thenReturn(0L);
        stubSaveAssignsId();

        seeder(true).run(null);

        ArgumentCaptor<IpoListingEntity> captor = ArgumentCaptor.forClass(IpoListingEntity.class);
        verify(listingRepository, times(8)).save(captor.capture());
        List<IpoListingEntity> saved = captor.getAllValues();

        assertThat(saved).allSatisfy(e -> {
            assertThat(e.getMatchKey()).isNotBlank();
            assertThat(e.getLogoUrl()).startsWith("https://logo.clearbit.com/");
            assertThat(e.getLogoDomain()).isNotBlank();
            assertThat(e.getLogoUrl()).endsWith(e.getLogoDomain());
            assertThat(e.getFirstSeenAt()).isEqualTo(NOW);
            assertThat(e.getLastSeenAt()).isEqualTo(NOW);
        });
        // Covers the required status matrix and both IPO types.
        assertThat(saved).extracting(IpoListingEntity::getStatus)
                .containsExactlyInAnyOrder("upcoming", "upcoming", "open", "open",
                        "closed", "listed", "listed", "listed");
        assertThat(saved).extracting(IpoListingEntity::getIpoType).contains("mainboard", "sme");
    }

    @Test
    void run_enabledAndTableEmpty_logoDomainMatchesEachCompanysRealDomain() {
        // logoDomain feeds the frontend's Logo.dev lookup (next group) — every sample company must
        // carry its real public domain, not a placeholder.
        when(listingRepository.count()).thenReturn(0L);
        stubSaveAssignsId();

        seeder(true).run(null);

        ArgumentCaptor<IpoListingEntity> captor = ArgumentCaptor.forClass(IpoListingEntity.class);
        verify(listingRepository, times(8)).save(captor.capture());
        Map<String, String> domainByCompany = captor.getAllValues().stream()
                .collect(Collectors.toMap(IpoListingEntity::getCompanyName, IpoListingEntity::getLogoDomain));

        assertThat(domainByCompany)
                .containsEntry("Zomato Ltd", "zomato.com")
                .containsEntry("FSN E-Commerce Ventures Ltd", "nykaa.com")
                .containsEntry("Life Insurance Corporation of India Ltd", "licindia.in")
                .containsEntry("Ola Electric Mobility Ltd", "olaelectric.com")
                .containsEntry("Swiggy Ltd", "swiggy.com")
                .containsEntry("Nazara Technologies Ltd", "nazara.com")
                .containsEntry("Honasa Consumer Ltd", "mamaearth.in")
                .containsEntry("One97 Communications Ltd", "paytm.com");
    }

    @Test
    void run_enabledAndTableEmpty_matchKeysAreUnique() {
        when(listingRepository.count()).thenReturn(0L);
        stubSaveAssignsId();

        seeder(true).run(null);

        ArgumentCaptor<IpoListingEntity> captor = ArgumentCaptor.forClass(IpoListingEntity.class);
        verify(listingRepository, times(8)).save(captor.capture());
        List<String> matchKeys = captor.getAllValues().stream().map(IpoListingEntity::getMatchKey).toList();

        assertThat(matchKeys).doesNotHaveDuplicates();
    }

    @Test
    void run_enabledAndTableEmpty_newFieldsArePopulatedForListedCompanies() {
        when(listingRepository.count()).thenReturn(0L);
        stubSaveAssignsId();

        seeder(true).run(null);

        ArgumentCaptor<IpoListingEntity> captor = ArgumentCaptor.forClass(IpoListingEntity.class);
        verify(listingRepository, times(8)).save(captor.capture());
        List<IpoListingEntity> saved = captor.getAllValues();

        assertThat(saved).allSatisfy(e -> {
            assertThat(e.getFaceValue()).isNotNull();
            assertThat(e.getFreshIssue()).isNotNull();
            assertThat(e.getOfferForSale()).isNotNull();
            assertThat(e.getStrengths()).isNotBlank();
            assertThat(e.getRisks()).isNotBlank();
        });
        assertThat(saved).filteredOn(e -> "listed".equals(e.getStatus()))
                .extracting(IpoListingEntity::getTickerSymbol)
                .allSatisfy(ticker -> assertThat(ticker).isNotBlank());
        assertThat(saved).filteredOn(e -> !"listed".equals(e.getStatus()))
                .extracting(IpoListingEntity::getTickerSymbol)
                .containsOnlyNulls();
    }

    @Test
    void run_enabledAndTableEmpty_aboutFieldsPopulatedForEveryCompany() {
        when(listingRepository.count()).thenReturn(0L);
        stubSaveAssignsId();

        seeder(true).run(null);

        ArgumentCaptor<IpoListingEntity> captor = ArgumentCaptor.forClass(IpoListingEntity.class);
        verify(listingRepository, times(8)).save(captor.capture());
        List<IpoListingEntity> saved = captor.getAllValues();

        // parentCompany is intentionally null for most (not every company has a distinct listed
        // parent), so it's not asserted non-null here — only the always-known facts are.
        assertThat(saved).allSatisfy(e -> {
            assertThat(e.getFoundedYear()).isNotNull();
            assertThat(e.getManagingDirector()).isNotBlank();
            assertThat(e.getSector()).isNotBlank();
            assertThat(e.getHeadquarters()).isNotBlank();
            assertThat(e.getWebsite()).isNotBlank();
        });
    }

    @Test
    void run_enabledAndTableEmpty_everyFinancialRowCarriesTotalAssetsAndPeriodEnd() {
        when(listingRepository.count()).thenReturn(0L);
        stubSaveAssignsId();

        seeder(true).run(null);

        ArgumentCaptor<IpoFinancialEntity> captor = ArgumentCaptor.forClass(IpoFinancialEntity.class);
        verify(financialRepository, times(26)).save(captor.capture());

        assertThat(captor.getAllValues()).allSatisfy(f -> {
            assertThat(f.getIpoId()).isNotBlank();
            assertThat(f.getTotalAssets()).isNotNull();
            assertThat(f.getPeriodEnd()).isNotNull();
        });
    }

    @Test
    void run_enabledAndTableEmpty_financialRowsPerIpoAreInChronologicalPeriodEndOrder() {
        // Regression guard for the ordering bug this unit fixes: the seeder must persist each
        // IPO's financial rows in periodEnd order (the real chronological key), never relying on
        // the fiscalYear display label sorting correctly as a string.
        when(listingRepository.count()).thenReturn(0L);
        stubSaveAssignsId();

        seeder(true).run(null);

        ArgumentCaptor<IpoFinancialEntity> captor = ArgumentCaptor.forClass(IpoFinancialEntity.class);
        verify(financialRepository, times(26)).save(captor.capture());

        Map<String, List<IpoFinancialEntity>> byIpo = captor.getAllValues().stream()
                .collect(Collectors.groupingBy(IpoFinancialEntity::getIpoId, LinkedHashMap::new, Collectors.toList()));

        assertThat(byIpo).isNotEmpty();
        byIpo.forEach((ipoId, rows) -> {
            List<LocalDate> periodEnds = rows.stream().map(IpoFinancialEntity::getPeriodEnd).toList();
            assertThat(periodEnds).isSorted();
        });
    }

    @Test
    void run_enabledAndTableEmpty_interimFinancialRow_usesDynamicMonthNotAHardcodedOne() {
        // NOW is fixed at 2026-07-24; the interim row (Zomato & Ola) must be labelled for the
        // month before "today" ("Jun 2026") computed off the injected clock — never a hardcoded
        // month like the old "Feb 2026" — with periodEnd at that month's last day.
        when(listingRepository.count()).thenReturn(0L);
        stubSaveAssignsId();

        seeder(true).run(null);

        ArgumentCaptor<IpoFinancialEntity> captor = ArgumentCaptor.forClass(IpoFinancialEntity.class);
        verify(financialRepository, times(26)).save(captor.capture());

        List<IpoFinancialEntity> interimRows = captor.getAllValues().stream()
                .filter(f -> "Jun 2026".equals(f.getFiscalYear()))
                .toList();

        assertThat(interimRows).hasSize(2); // Zomato + Ola are the two seeded with an interim row
        assertThat(interimRows).allSatisfy(f -> assertThat(f.getPeriodEnd()).isEqualTo(LocalDate.of(2026, 6, 30)));
    }

    @Test
    void run_enabledAndTableEmpty_everySubscriptionHistoryRowCarriesNonEmptyCategoriesSummingToTotal() {
        when(listingRepository.count()).thenReturn(0L);
        stubSaveAssignsId();

        seeder(true).run(null);

        ArgumentCaptor<IpoSubscriptionHistoryEntity> captor = ArgumentCaptor.forClass(IpoSubscriptionHistoryEntity.class);
        verify(subscriptionHistoryRepository, times(15)).save(captor.capture());

        assertThat(captor.getAllValues()).allSatisfy(row -> {
            assertThat(row.getTotal()).isNotNull();
            Map<String, BigDecimal> categories = IpoSubscriptionJson.fromJson(row.getCategoriesJson());
            assertThat(categories).isNotEmpty();
            BigDecimal sum = categories.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            // Per-category rounding (2dp each) can drift slightly from the point's total; 0.05 comfortably
            // covers that for up to 5 categories.
            assertThat(sum).isCloseTo(row.getTotal(), offset(new BigDecimal("0.05")));
        });
    }

    @Test
    void run_enabledAndTableEmpty_mostCompaniesGetTheDefaultThreeCategories_twoGetExtrasForTheDynamicUi() {
        // Only Zomato, LIC and Ola Electric are seeded with any trading history at all (see
        // seedTradingHistory(true) in buildSampleIpoSpecs); listingRepository.save assigns ids in
        // spec-list order (Zomato, Nykaa, LIC, Ola, ...) via the stubbed counter, so those three
        // land on ids "sample-ipo-1", "sample-ipo-3" and "sample-ipo-4" respectively.
        when(listingRepository.count()).thenReturn(0L);
        stubSaveAssignsId();

        seeder(true).run(null);

        ArgumentCaptor<IpoSubscriptionHistoryEntity> captor = ArgumentCaptor.forClass(IpoSubscriptionHistoryEntity.class);
        verify(subscriptionHistoryRepository, times(15)).save(captor.capture());
        Map<String, List<IpoSubscriptionHistoryEntity>> byIpoId = captor.getAllValues().stream()
                .collect(Collectors.groupingBy(IpoSubscriptionHistoryEntity::getIpoId, LinkedHashMap::new, Collectors.toList()));

        assertThat(byIpoId).hasSize(3);

        List<IpoSubscriptionHistoryEntity> zomato = byIpoId.get("sample-ipo-1");
        assertThat(zomato).hasSize(5);
        assertThat(IpoSubscriptionJson.fromJson(zomato.get(4).getCategoriesJson()).keySet())
                .containsExactly("QIB", "NII", "Retail", "Employee", "Anchor");

        List<IpoSubscriptionHistoryEntity> lic = byIpoId.get("sample-ipo-3");
        assertThat(lic).hasSize(5);
        assertThat(IpoSubscriptionJson.fromJson(lic.get(4).getCategoriesJson()).keySet())
                .containsExactly("QIB", "NII", "Retail", "Employee", "Shareholder");

        List<IpoSubscriptionHistoryEntity> ola = byIpoId.get("sample-ipo-4");
        assertThat(ola).hasSize(5);
        assertThat(IpoSubscriptionJson.fromJson(ola.get(4).getCategoriesJson()).keySet())
                .containsExactly("QIB", "NII", "Retail");
    }

    @Test
    void run_enabledAndTableEmpty_subscriptionHistoryCategoryValuesGrowTowardTheFinalTotal() {
        when(listingRepository.count()).thenReturn(0L);
        stubSaveAssignsId();

        seeder(true).run(null);

        ArgumentCaptor<IpoSubscriptionHistoryEntity> captor = ArgumentCaptor.forClass(IpoSubscriptionHistoryEntity.class);
        verify(subscriptionHistoryRepository, times(15)).save(captor.capture());
        List<IpoSubscriptionHistoryEntity> zomato = captor.getAllValues().stream()
                .filter(row -> "sample-ipo-1".equals(row.getIpoId())).toList();

        List<BigDecimal> qibOverTime = zomato.stream()
                .map(row -> IpoSubscriptionJson.fromJson(row.getCategoriesJson()).get("QIB"))
                .toList();

        assertThat(qibOverTime).hasSize(5);
        assertThat(qibOverTime).allSatisfy(v -> assertThat(v).isNotNull());
        assertThat(qibOverTime).isSortedAccordingTo(BigDecimal::compareTo);
    }
}
