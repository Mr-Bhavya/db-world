package com.db.dbworld.app.ipo.seed;

import com.db.dbworld.app.ipo.dto.IpoDto;
import com.db.dbworld.app.ipo.dto.IpoFinancialDto;
import com.db.dbworld.app.ipo.entity.IpoFinancialEntity;
import com.db.dbworld.app.ipo.entity.IpoGmpHistoryEntity;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.entity.IpoSubscriptionHistoryEntity;
import com.db.dbworld.app.ipo.repository.IpoFinancialRepository;
import com.db.dbworld.app.ipo.repository.IpoGmpHistoryRepository;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.app.ipo.repository.IpoSubscriptionHistoryRepository;
import com.db.dbworld.app.ipo.service.IpoNormalizer;
import lombok.Builder;
import lombok.Getter;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

/**
 * DEV-only convenience: seeds a realistic spread of sample IPOs (every status/type combination,
 * with GMP/subscription history and financials) so the frontend has real-looking data to build
 * and demo against without waiting on live source polling.
 *
 * <p><b>Prod-safe by construction</b>: gated by {@code dbworld.ipo.sample-data.enabled}
 * (default {@code false}) AND only ever runs when {@code ipo_listing} is completely empty — so
 * it can never clobber real ingested data, and re-running it (e.g. on every local restart) is a
 * no-op once the table has rows. Leave the flag unset/false everywhere except a local dev
 * profile.
 */
@Log4j2
@Component
public class IpoSampleDataSeeder implements ApplicationRunner {

    private final IpoListingRepository listingRepository;
    private final IpoGmpHistoryRepository gmpHistoryRepository;
    private final IpoSubscriptionHistoryRepository subscriptionHistoryRepository;
    private final IpoFinancialRepository financialRepository;
    private final IpoNormalizer normalizer;
    private final boolean enabled;
    private final Clock clock;

    @Autowired
    public IpoSampleDataSeeder(IpoListingRepository listingRepository,
                                IpoGmpHistoryRepository gmpHistoryRepository,
                                IpoSubscriptionHistoryRepository subscriptionHistoryRepository,
                                IpoFinancialRepository financialRepository,
                                IpoNormalizer normalizer,
                                @Value("${dbworld.ipo.sample-data.enabled:false}") boolean enabled) {
        this(listingRepository, gmpHistoryRepository, subscriptionHistoryRepository, financialRepository,
                normalizer, enabled, Clock.systemUTC());
    }

    /** Test-friendly constructor with an injectable clock for deterministic relative dates. */
    IpoSampleDataSeeder(IpoListingRepository listingRepository,
                         IpoGmpHistoryRepository gmpHistoryRepository,
                         IpoSubscriptionHistoryRepository subscriptionHistoryRepository,
                         IpoFinancialRepository financialRepository,
                         IpoNormalizer normalizer,
                         boolean enabled,
                         Clock clock) {
        this.listingRepository = listingRepository;
        this.gmpHistoryRepository = gmpHistoryRepository;
        this.subscriptionHistoryRepository = subscriptionHistoryRepository;
        this.financialRepository = financialRepository;
        this.normalizer = normalizer;
        this.enabled = enabled;
        this.clock = clock;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            log.info("IPO sample-data seeder: disabled (dbworld.ipo.sample-data.enabled=false) — skipping");
            return;
        }
        if (listingRepository.count() > 0) {
            log.info("IPO sample-data seeder: ipo_listing already has data — skipping (idempotent, never overwrites real data)");
            return;
        }

        LocalDate today = LocalDate.now(clock);
        Instant now = Instant.now(clock);
        List<SampleIpo> specs = buildSampleIpoSpecs(today);

        List<IpoListingEntity> saved = new ArrayList<>(specs.size());
        for (SampleIpo spec : specs) {
            saved.add(listingRepository.save(toEntity(spec, now)));
        }
        seedTradingHistoryAndFinancials(saved, specs, today);

        log.info("IPO sample-data seeder: seeded {} sample IPOs (statuses/types mixed, {} with GMP/subscription history)",
                saved.size(), specs.stream().filter(SampleIpo::isSeedTradingHistory).count());
    }

    private IpoListingEntity toEntity(SampleIpo spec, Instant now) {
        return IpoListingEntity.builder()
                .matchKey(matchKeyFor(spec.getCompanyName(), spec.getOpenDate()))
                .companyName(spec.getCompanyName())
                .ipoType(spec.getIpoType())
                .status(spec.getStatus())
                .openDate(spec.getOpenDate())
                .closeDate(spec.getCloseDate())
                .allotmentDate(spec.getAllotmentDate())
                .listingDate(spec.getListingDate())
                .priceMin(spec.getPriceMin())
                .priceMax(spec.getPriceMax())
                .listingPrice(spec.getListingPrice())
                .listingGainPct(spec.getListingGainPct())
                .gmp(spec.getGmp())
                .gmpPct(spec.getGmpPct())
                .subTotal(spec.getSubTotal())
                .lotSize(spec.getLotSize())
                .issueSize(spec.getIssueSize())
                .listingExchange(spec.getListingExchange())
                .allotmentStatus(spec.getAllotmentStatus())
                .registrar(spec.getRegistrar())
                .registrarUrl(spec.getRegistrarUrl())
                .logoUrl(logoUrlFor(spec.getCompanyName()))
                .about(spec.getAbout())
                .firstSeenAt(now)
                .lastSeenAt(now)
                .build();
    }

    private void seedTradingHistoryAndFinancials(List<IpoListingEntity> saved, List<SampleIpo> specs, LocalDate today) {
        for (int i = 0; i < saved.size(); i++) {
            IpoListingEntity entity = saved.get(i);
            SampleIpo spec = specs.get(i);

            for (IpoFinancialDto f : spec.getFinancials()) {
                financialRepository.save(IpoFinancialEntity.builder()
                        .ipoId(entity.getId())
                        .fiscalYear(f.fiscalYear())
                        .revenue(f.revenue())
                        .pat(f.pat())
                        .build());
            }

            if (spec.isSeedTradingHistory()) {
                seedGmpHistory(entity.getId(), spec.getGmp(), spec.getGmpPct(), today);
                seedSubscriptionHistory(entity.getId(), spec.getSubTotal(), today);
            }
        }
    }

    /** Five points over the last ~10 days, rising toward the final value but with one volatile dip. */
    private void seedGmpHistory(String ipoId, BigDecimal finalGmp, BigDecimal finalGmpPct, LocalDate today) {
        double[] fractions = {0.55, 0.70, 0.60, 0.85, 1.00};
        int[] daysAgo = {9, 7, 5, 3, 1};
        for (int i = 0; i < fractions.length; i++) {
            gmpHistoryRepository.save(IpoGmpHistoryEntity.builder()
                    .ipoId(ipoId)
                    .gmp(scale(finalGmp, fractions[i]))
                    .gmpPct(scale(finalGmpPct, fractions[i]))
                    .source("seed")
                    .capturedAt(instantAt(today.minusDays(daysAgo[i])))
                    .build());
        }
    }

    /** Five points over the last ~10 days, steadily increasing toward the final subscription total. */
    private void seedSubscriptionHistory(String ipoId, BigDecimal finalTotal, LocalDate today) {
        double[] fractions = {0.10, 0.35, 0.65, 0.85, 1.00};
        int[] daysAgo = {9, 7, 5, 3, 1};
        for (int i = 0; i < fractions.length; i++) {
            BigDecimal total = scale(finalTotal, fractions[i]);
            subscriptionHistoryRepository.save(IpoSubscriptionHistoryEntity.builder()
                    .ipoId(ipoId)
                    .qib(scale(total, 0.45))
                    .nii(scale(total, 0.30))
                    .retail(scale(total, 0.25))
                    .total(total)
                    .source("seed")
                    .capturedAt(instantAt(today.minusDays(daysAgo[i])))
                    .build());
        }
    }

    private static BigDecimal scale(BigDecimal value, double fraction) {
        return value == null ? null : value.multiply(BigDecimal.valueOf(fraction)).setScale(2, RoundingMode.HALF_UP);
    }

    private static Instant instantAt(LocalDate date) {
        return date.atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    private static String logoUrlFor(String companyName) {
        return "https://ui-avatars.com/api/?name=" + companyName.replace(" ", "+") + "&background=random&size=128";
    }

    /** Builds a minimal probe dto (only company name + open date matter) to reuse the real matchKey algorithm. */
    private String matchKeyFor(String companyName, LocalDate openDate) {
        IpoDto probe = new IpoDto(null, null, companyName, null, null, openDate, null, null, null,
                null, null, null, null, null, null, null,
                null, null, null, null, null, null,
                null, null, null, null, null, null, null,
                null, null, null, null, null, null);
        return normalizer.matchKey(probe);
    }

    private static List<IpoFinancialDto> financials(String fy22Rev, String fy22Pat, String fy23Rev, String fy23Pat,
                                                     String fy24Rev, String fy24Pat) {
        return List.of(
                new IpoFinancialDto("FY22", new BigDecimal(fy22Rev), new BigDecimal(fy22Pat)),
                new IpoFinancialDto("FY23", new BigDecimal(fy23Rev), new BigDecimal(fy23Pat)),
                new IpoFinancialDto("FY24", new BigDecimal(fy24Rev), new BigDecimal(fy24Pat))
        );
    }

    // =====================================================================================
    // The sample matrix — 10 IPOs covering mainboard/sme x upcoming/open/closed/listed.
    // Dates are computed relative to `today` so the data always looks "live". Add/edit entries
    // here to extend the sample set; nothing else needs to change.
    // =====================================================================================
    private static List<SampleIpo> buildSampleIpoSpecs(LocalDate today) {
        List<SampleIpo> ipos = new ArrayList<>();

        // ── Upcoming (3): opens 5-15 days from now, no market data yet ──────────────────────
        ipos.add(SampleIpo.builder()
                .companyName("Nova Renewables Ltd").ipoType("mainboard").status("upcoming")
                .openDate(today.plusDays(7)).closeDate(today.plusDays(10))
                .priceMin(new BigDecimal("210.00")).priceMax(new BigDecimal("225.00"))
                .lotSize(65).issueSize("₹850 Cr").listingExchange("NSE")
                .registrar("KFin Technologies").registrarUrl("https://kprism.kfintech.com/ipostatus/")
                .about("Nova Renewables designs and operates utility-scale solar and wind assets across "
                        + "western India. The company has a 1.2 GW operational portfolio and a further "
                        + "800 MW under construction.")
                .financials(financials("2150.00", "180.00", "2640.00", "245.00", "3120.00", "310.00"))
                .build());

        ipos.add(SampleIpo.builder()
                .companyName("BlueOrbit Logistics Ltd").ipoType("mainboard").status("upcoming")
                .openDate(today.plusDays(12)).closeDate(today.plusDays(15))
                .priceMin(new BigDecimal("140.00")).priceMax(new BigDecimal("148.00"))
                .lotSize(100).issueSize("₹620 Cr").listingExchange("BSE")
                .registrar("Link Intime India").registrarUrl("https://linkintime.co.in/MIPO/ipoallotment.html")
                .about("BlueOrbit runs a pan-India network of automated warehouses and last-mile delivery "
                        + "hubs serving e-commerce and FMCG clients.")
                .financials(financials("980.00", "62.00", "1210.00", "88.00", "1480.00", "121.00"))
                .build());

        ipos.add(SampleIpo.builder()
                .companyName("Sunrise Foods SME Ltd").ipoType("sme").status("upcoming")
                .openDate(today.plusDays(15)).closeDate(today.plusDays(18))
                .priceMin(new BigDecimal("68.00")).priceMax(new BigDecimal("72.00"))
                .lotSize(1600).issueSize("₹42 Cr").listingExchange("NSE")
                .registrar("Bigshare Services").registrarUrl("https://ipo.bigshareonline.com/ipo_status.html")
                .about("Sunrise Foods makes packaged regional snacks and is expanding distribution from its "
                        + "home state into a pan-India modern-trade footprint.")
                .financials(financials("58.00", "4.20", "76.00", "6.80", "94.00", "9.10"))
                .build());

        // ── Open (2): a few days into the subscription window ───────────────────────────────
        ipos.add(SampleIpo.builder()
                .companyName("Quantum Fintech Ltd").ipoType("mainboard").status("open")
                .openDate(today.minusDays(2)).closeDate(today.plusDays(2))
                .priceMin(new BigDecimal("455.00")).priceMax(new BigDecimal("480.00"))
                .lotSize(31).issueSize("₹1240 Cr").listingExchange("BOTH")
                .gmp(new BigDecimal("45.00")).gmpPct(new BigDecimal("9.89")).subTotal(new BigDecimal("3.20"))
                .registrar("KFin Technologies").registrarUrl("https://kprism.kfintech.com/ipostatus/")
                .about("Quantum Fintech operates a digital lending and payments platform serving small "
                        + "merchants and gig workers underserved by traditional banks.")
                .financials(financials("340.00", "15.00", "610.00", "42.00", "980.00", "95.00"))
                .seedTradingHistory(true)
                .build());

        ipos.add(SampleIpo.builder()
                .companyName("Greenfield Agrotech SME Ltd").ipoType("sme").status("open")
                .openDate(today.minusDays(1)).closeDate(today.plusDays(3))
                .priceMin(new BigDecimal("88.00")).priceMax(new BigDecimal("92.00"))
                .lotSize(1200).issueSize("₹35 Cr").listingExchange("NSE")
                .gmp(new BigDecimal("12.00")).gmpPct(new BigDecimal("13.64")).subTotal(new BigDecimal("5.80"))
                .registrar("Bigshare Services").registrarUrl("https://ipo.bigshareonline.com/ipo_status.html")
                .about("Greenfield Agrotech develops hybrid seed varieties and agri-input products for "
                        + "smallholder farmers across central India.")
                .financials(financials("45.00", "3.10", "58.00", "4.40", "71.00", "5.90"))
                .build());

        // ── Closed (2): one just closed (allotment awaited), one closed longer ago (finalized) ─
        ipos.add(SampleIpo.builder()
                .companyName("Orbit Pharma Ltd").ipoType("mainboard").status("closed")
                .openDate(today.minusDays(6)).closeDate(today.minusDays(3)).allotmentDate(today.plusDays(1))
                .priceMin(new BigDecimal("610.00")).priceMax(new BigDecimal("640.00"))
                .lotSize(23).issueSize("₹980 Cr").listingExchange("NSE")
                .gmp(new BigDecimal("30.00")).gmpPct(new BigDecimal("4.92")).subTotal(new BigDecimal("22.50"))
                .allotmentStatus("awaited")
                .registrar("Link Intime India").registrarUrl("https://linkintime.co.in/MIPO/ipoallotment.html")
                .about("Orbit Pharma manufactures generic and specialty formulations for export to "
                        + "regulated markets in the US and EU.")
                .financials(financials("1450.00", "165.00", "1680.00", "205.00", "1920.00", "248.00"))
                .build());

        ipos.add(SampleIpo.builder()
                .companyName("Metro SME Textiles Ltd").ipoType("sme").status("closed")
                .openDate(today.minusDays(12)).closeDate(today.minusDays(9)).allotmentDate(today.minusDays(6))
                .priceMin(new BigDecimal("55.00")).priceMax(new BigDecimal("58.00"))
                .lotSize(2000).issueSize("₹18 Cr").listingExchange("NSE")
                .gmp(new BigDecimal("8.00")).gmpPct(new BigDecimal("13.79")).subTotal(new BigDecimal("45.30"))
                .allotmentStatus("finalized")
                .registrar("Bigshare Services").registrarUrl("https://ipo.bigshareonline.com/ipo_status.html")
                .about("Metro Textiles exports home-furnishing fabrics and made-ups to retailers across "
                        + "Europe and the Middle East.")
                .financials(financials("62.00", "5.10", "74.00", "6.30", "89.00", "8.20"))
                .build());

        // ── Listed (3): 1-4 weeks ago, one with a negative listing-day gain ──────────────────
        ipos.add(SampleIpo.builder()
                .companyName("Stellar Auto Components Ltd").ipoType("mainboard").status("listed")
                .openDate(today.minusDays(23)).closeDate(today.minusDays(20))
                .allotmentDate(today.minusDays(17)).listingDate(today.minusDays(14))
                .priceMin(new BigDecimal("250.00")).priceMax(new BigDecimal("265.00"))
                .lotSize(56).issueSize("₹740 Cr").listingExchange("BOTH")
                .listingPrice(new BigDecimal("310.00")).listingGainPct(new BigDecimal("16.98"))
                .gmp(new BigDecimal("42.00")).gmpPct(new BigDecimal("15.85")).subTotal(new BigDecimal("32.60"))
                .allotmentStatus("finalized")
                .registrar("KFin Technologies").registrarUrl("https://kprism.kfintech.com/ipostatus/")
                .about("Stellar Auto Components supplies precision-machined drivetrain parts to both "
                        + "internal-combustion and EV OEMs across India and Southeast Asia.")
                .financials(financials("980.00", "58.00", "1240.00", "82.00", "1560.00", "118.00"))
                .seedTradingHistory(true)
                .build());

        ipos.add(SampleIpo.builder()
                .companyName("Bright Horizon Realty Ltd").ipoType("mainboard").status("listed")
                .openDate(today.minusDays(37)).closeDate(today.minusDays(34))
                .allotmentDate(today.minusDays(31)).listingDate(today.minusDays(28))
                .priceMin(new BigDecimal("175.00")).priceMax(new BigDecimal("185.00"))
                .lotSize(81).issueSize("₹610 Cr").listingExchange("NSE")
                .listingPrice(new BigDecimal("165.00")).listingGainPct(new BigDecimal("-10.81"))
                .gmp(new BigDecimal("-5.00")).gmpPct(new BigDecimal("-2.70")).subTotal(new BigDecimal("1.85"))
                .allotmentStatus("finalized")
                .registrar("Link Intime India").registrarUrl("https://linkintime.co.in/MIPO/ipoallotment.html")
                .about("Bright Horizon develops commercial and residential real estate in the National "
                        + "Capital Region, with a mixed-use project pipeline.")
                .financials(financials("410.00", "-35.00", "520.00", "-12.00", "610.00", "28.00"))
                .build());

        ipos.add(SampleIpo.builder()
                .companyName("Apex SME Engineering Ltd").ipoType("sme").status("listed")
                .openDate(today.minusDays(16)).closeDate(today.minusDays(13))
                .allotmentDate(today.minusDays(10)).listingDate(today.minusDays(7))
                .priceMin(new BigDecimal("118.00")).priceMax(new BigDecimal("125.00"))
                .lotSize(1000).issueSize("₹28 Cr").listingExchange("NSE")
                .listingPrice(new BigDecimal("148.00")).listingGainPct(new BigDecimal("18.40"))
                .gmp(new BigDecimal("20.00")).gmpPct(new BigDecimal("16.00")).subTotal(new BigDecimal("68.40"))
                .allotmentStatus("finalized")
                .registrar("Bigshare Services").registrarUrl("https://ipo.bigshareonline.com/ipo_status.html")
                .about("Apex SME Engineering manufactures precision tooling and automation components for "
                        + "the industrial machinery sector.")
                .financials(financials("52.00", "4.80", "68.00", "6.90", "89.00", "9.80"))
                .seedTradingHistory(true)
                .build());

        return ipos;
    }

    /** One entry in the builder list above — plain data, converted to an entity by {@link #toEntity}. */
    @Getter
    @Builder
    private static class SampleIpo {
        private String companyName;
        private String ipoType;
        private String status;
        private LocalDate openDate;
        private LocalDate closeDate;
        private LocalDate allotmentDate;
        private LocalDate listingDate;
        private BigDecimal priceMin;
        private BigDecimal priceMax;
        private Integer lotSize;
        private String issueSize;
        private String listingExchange;
        private BigDecimal listingPrice;
        private BigDecimal listingGainPct;
        private BigDecimal gmp;
        private BigDecimal gmpPct;
        private BigDecimal subTotal;
        private String allotmentStatus;
        private String registrar;
        private String registrarUrl;
        private String about;
        private boolean seedTradingHistory;
        private List<IpoFinancialDto> financials;
    }
}
