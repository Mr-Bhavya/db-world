package com.db.dbworld.app.ipo.seed;

import com.db.dbworld.app.ipo.dto.IpoDto;
import com.db.dbworld.app.ipo.entity.IpoFinancialEntity;
import com.db.dbworld.app.ipo.entity.IpoGmpHistoryEntity;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.entity.IpoSubscriptionHistoryEntity;
import com.db.dbworld.app.ipo.repository.IpoFinancialRepository;
import com.db.dbworld.app.ipo.repository.IpoGmpHistoryRepository;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.app.ipo.repository.IpoSubscriptionHistoryRepository;
import com.db.dbworld.app.ipo.service.IpoNormalizer;
import com.db.dbworld.app.ipo.service.IpoSubscriptionJson;
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
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * DEV-only convenience: seeds a realistic spread of sample IPOs (every status/type combination,
 * with GMP/subscription history and financials) so the frontend has real-looking data to build
 * and demo against without waiting on live source polling.
 *
 * <p>Samples are modelled on real, well-known Indian companies (Zomato, Nykaa, LIC, ...) so their
 * Clearbit-logo lookups actually resolve — but every date, price, GMP, subscription and financial
 * figure here is illustrative demo data, not a live feed. See {@link #buildSampleIpoSpecs}.
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
                .logoUrl(logoUrlFor(spec.getDomain()))
                .logoDomain(spec.getDomain())
                .about(spec.getAbout())
                .faceValue(spec.getFaceValue())
                .freshIssue(spec.getFreshIssue())
                .offerForSale(spec.getOfferForSale())
                .tickerSymbol(spec.getTickerSymbol())
                .strengths(spec.getStrengths())
                .risks(spec.getRisks())
                .foundedYear(spec.getFoundedYear())
                .managingDirector(spec.getManagingDirector())
                .parentCompany(spec.getParentCompany())
                .sector(spec.getSector())
                .headquarters(spec.getHeadquarters())
                .website(spec.getWebsite())
                .firstSeenAt(now)
                .lastSeenAt(now)
                .build();
    }

    private void seedTradingHistoryAndFinancials(List<IpoListingEntity> saved, List<SampleIpo> specs, LocalDate today) {
        for (int i = 0; i < saved.size(); i++) {
            IpoListingEntity entity = saved.get(i);
            SampleIpo spec = specs.get(i);

            for (FinancialRow f : spec.getFinancials()) {
                financialRepository.save(IpoFinancialEntity.builder()
                        .ipoId(entity.getId())
                        .fiscalYear(f.fiscalYear())
                        .revenue(f.revenue())
                        .pat(f.pat())
                        .totalAssets(f.totalAssets())
                        .periodEnd(f.periodEnd())
                        .build());
            }

            if (spec.isSeedTradingHistory()) {
                seedGmpHistory(entity.getId(), spec.getGmp(), spec.getGmpPct(), today);
                Map<String, Double> categoryWeights = spec.getSubscriptionCategoryWeights() != null
                        ? spec.getSubscriptionCategoryWeights() : defaultCategoryWeights();
                seedSubscriptionHistory(entity.getId(), spec.getSubTotal(), today, categoryWeights);
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

    /**
     * Five points over the last ~10 days, steadily increasing toward the final subscription
     * total, split across {@code categoryWeights} (fractions of each point's total; insertion
     * order preserved end-to-end into {@code categoriesJson} so the frontend gets a stable
     * category order straight from the seed data).
     */
    private void seedSubscriptionHistory(String ipoId, BigDecimal finalTotal, LocalDate today,
                                          Map<String, Double> categoryWeights) {
        double[] fractions = {0.10, 0.35, 0.65, 0.85, 1.00};
        int[] daysAgo = {9, 7, 5, 3, 1};
        for (int i = 0; i < fractions.length; i++) {
            BigDecimal total = scale(finalTotal, fractions[i]);
            Map<String, BigDecimal> categories = new LinkedHashMap<>();
            categoryWeights.forEach((category, weight) -> categories.put(category, scale(total, weight)));
            subscriptionHistoryRepository.save(IpoSubscriptionHistoryEntity.builder()
                    .ipoId(ipoId)
                    .categoriesJson(IpoSubscriptionJson.toJson(categories))
                    .total(total)
                    .source("seed")
                    .capturedAt(instantAt(today.minusDays(daysAgo[i])))
                    .build());
        }
    }

    /** The default 3-way split most sample IPOs use. */
    private static Map<String, Double> defaultCategoryWeights() {
        Map<String, Double> weights = new LinkedHashMap<>();
        weights.put("QIB", 0.45);
        weights.put("NII", 0.30);
        weights.put("Retail", 0.25);
        return weights;
    }

    /** Zomato: adds an Employee reservation and an Anchor tranche alongside the usual three, so the dynamic UI has something to show. */
    private static Map<String, Double> zomatoCategoryWeights() {
        Map<String, Double> weights = new LinkedHashMap<>();
        weights.put("QIB", 0.35);
        weights.put("NII", 0.22);
        weights.put("Retail", 0.18);
        weights.put("Employee", 0.10);
        weights.put("Anchor", 0.15);
        return weights;
    }

    /** LIC: adds Employee and Shareholder (policyholder) reservation categories alongside the usual three. */
    private static Map<String, Double> licCategoryWeights() {
        Map<String, Double> weights = new LinkedHashMap<>();
        weights.put("QIB", 0.25);
        weights.put("NII", 0.15);
        weights.put("Retail", 0.10);
        weights.put("Employee", 0.05);
        weights.put("Shareholder", 0.45);
        return weights;
    }

    private static BigDecimal scale(BigDecimal value, double fraction) {
        return value == null ? null : value.multiply(BigDecimal.valueOf(fraction)).setScale(2, RoundingMode.HALF_UP);
    }

    private static Instant instantAt(LocalDate date) {
        return date.atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    /** Clearbit resolves a company's logo straight from its domain; the FE falls back to initials on a 404. */
    private static String logoUrlFor(String domain) {
        return "https://logo.clearbit.com/" + domain;
    }

    /** Builds a minimal probe dto (only company name + open date matter) to reuse the real matchKey algorithm. */
    private String matchKeyFor(String companyName, LocalDate openDate) {
        IpoDto probe = new IpoDto(null, null, companyName, null, null, openDate, null, null, null,
                null, null, null, null, null, null, null,
                null, null, null, null,
                null, null, null, null, null, null, null,
                null, null, null, null, null, null);
        return normalizer.matchKey(probe);
    }

    /** A completed fiscal year's figures; {@code periodEnd} is the real sort key, {@code fiscalYear} the display label. */
    private static FinancialRow fy(String fiscalYear, LocalDate periodEnd, String revenue, String pat, String totalAssets) {
        return new FinancialRow(fiscalYear, new BigDecimal(revenue), new BigDecimal(pat), new BigDecimal(totalAssets), periodEnd);
    }

    /**
     * The latest available (interim/TTM) figures, labelled by the month they were reported —
     * computed relative to {@code today} (one month back) so it's always current, e.g. "Jun 2026"
     * when seeded in July 2026, never a hardcoded stale month.
     */
    private static final DateTimeFormatter INTERIM_MONTH_LABEL = DateTimeFormatter.ofPattern("MMM yyyy", Locale.ENGLISH);

    private static FinancialRow interimFy(LocalDate today, String revenue, String pat, String totalAssets) {
        YearMonth interimMonth = YearMonth.from(today).minusMonths(1);
        String label = interimMonth.format(INTERIM_MONTH_LABEL);
        return new FinancialRow(label, new BigDecimal(revenue), new BigDecimal(pat), new BigDecimal(totalAssets),
                interimMonth.atEndOfMonth());
    }

    private static String bullets(String... lines) {
        return String.join("\n", lines);
    }

    // =====================================================================================
    // The sample matrix — 8 IPOs modelled on real, well-known Indian companies (so Clearbit
    // logos resolve), spread across every status and mostly mainboard with a couple SME.
    // Dates are computed relative to `today` so the data always looks "live"; every other
    // figure (price, GMP, subscription, financials) is illustrative demo data, not a live feed.
    // Add/edit entries here to extend the sample set; nothing else needs to change.
    // =====================================================================================
    private static List<SampleIpo> buildSampleIpoSpecs(LocalDate today) {
        List<SampleIpo> ipos = new ArrayList<>();

        // ── Listed (3): 2-7 weeks ago, one with a negative listing-day gain (LIC) ────────────
        ipos.add(SampleIpo.builder()
                .companyName("Zomato Ltd").domain("zomato.com").ipoType("mainboard").status("listed")
                .openDate(today.minusDays(40)).closeDate(today.minusDays(37))
                .allotmentDate(today.minusDays(34)).listingDate(today.minusDays(30))
                .priceMin(new BigDecimal("72.00")).priceMax(new BigDecimal("76.00"))
                .lotSize(195).issueSize("₹9,375 Cr").listingExchange("BOTH")
                .listingPrice(new BigDecimal("115.00")).listingGainPct(new BigDecimal("51.32"))
                .gmp(new BigDecimal("39.00")).gmpPct(new BigDecimal("51.32")).subTotal(new BigDecimal("38.25"))
                .allotmentStatus("finalized")
                .registrar("Link Intime India").registrarUrl("https://linkintime.co.in/MIPO/ipoallotment.html")
                .faceValue(new BigDecimal("1.00")).freshIssue(new BigDecimal("9375.00")).offerForSale(BigDecimal.ZERO)
                .tickerSymbol("ZOMATO")
                .foundedYear(2008).managingDirector("Deepinder Goyal").parentCompany("Eternal Ltd")
                .sector("Foodtech").headquarters("Gurugram").website("https://www.zomato.com")
                .about("Zomato operates a category-leading food-delivery platform across 1,000+ Indian cities, "
                        + "with a fast-growing quick-commerce arm (Blinkit) alongside its core dining-out and "
                        + "advertising businesses.")
                .strengths(bullets(
                        "Category-leading food-delivery platform with pan-India, 1,000+ city presence",
                        "Diversified revenue via Zomato Gold, dining-out ads, and quick-commerce (Blinkit)",
                        "Asset-light logistics network with a large, flexible delivery-partner base",
                        "Strong brand recall and high app engagement among urban consumers"))
                .risks(bullets(
                        "History of losses; profitability depends on scaling quick-commerce economics",
                        "Intense competition from Swiggy and other hyperlocal delivery entrants",
                        "Delivery-partner cost inflation and regulatory scrutiny over gig-worker classification",
                        "Discount-driven customer acquisition pressures unit economics"))
                .financials(List.of(
                        fy("FY 2022-23", LocalDate.of(2023, 3, 31), "4192.40", "-971.00", "6800.00"),
                        fy("FY 2023-24", LocalDate.of(2024, 3, 31), "7079.60", "175.00", "9600.00"),
                        fy("FY 2024-25", LocalDate.of(2025, 3, 31), "10200.00", "780.00", "13200.00"),
                        interimFy(today, "12800.00", "1150.00", "15400.00")))
                .seedTradingHistory(true)
                .subscriptionCategoryWeights(zomatoCategoryWeights())
                .build());

        ipos.add(SampleIpo.builder()
                .companyName("FSN E-Commerce Ventures Ltd").domain("nykaa.com").ipoType("mainboard").status("listed")
                .openDate(today.minusDays(51)).closeDate(today.minusDays(48))
                .allotmentDate(today.minusDays(45)).listingDate(today.minusDays(41))
                .priceMin(new BigDecimal("1085.00")).priceMax(new BigDecimal("1125.00"))
                .lotSize(12).issueSize("₹5,352 Cr").listingExchange("BOTH")
                .listingPrice(new BigDecimal("2001.00")).listingGainPct(new BigDecimal("77.87"))
                .gmp(new BigDecimal("875.00")).gmpPct(new BigDecimal("77.78")).subTotal(new BigDecimal("82.00"))
                .allotmentStatus("finalized")
                .registrar("Link Intime India").registrarUrl("https://linkintime.co.in/MIPO/ipoallotment.html")
                .faceValue(new BigDecimal("1.00")).freshIssue(new BigDecimal("630.00")).offerForSale(new BigDecimal("4722.00"))
                .tickerSymbol("NYKAA")
                .foundedYear(2012).managingDirector("Falguni Nayar").parentCompany(null)
                .sector("Beauty & E-commerce").headquarters("Mumbai").website("https://www.nykaa.com")
                .about("FSN E-Commerce (Nykaa) runs a leading omni-channel beauty and personal-care platform, "
                        + "combining a curated online marketplace with a growing owned-brand portfolio and "
                        + "physical retail footprint.")
                .strengths(bullets(
                        "Leading omni-channel beauty and personal-care platform with a strong owned-brand portfolio",
                        "High customer retention and repeat-purchase rates in the BPC category",
                        "Curated marketplace model builds trust with premium and D2C beauty labels",
                        "Expanding physical retail footprint complements the online business"))
                .risks(bullets(
                        "Rising competition from Amazon, Flipkart and quick-commerce players in beauty e-commerce",
                        "Reliant on continued growth in discretionary consumer spending",
                        "Margin pressure from customer-acquisition and warehousing costs",
                        "Concentration risk in a small set of hero brands/categories"))
                .financials(List.of(
                        fy("FY 2022-23", LocalDate.of(2023, 3, 31), "3772.80", "20.30", "2950.00"),
                        fy("FY 2023-24", LocalDate.of(2024, 3, 31), "5143.60", "21.90", "3610.00"),
                        fy("FY 2024-25", LocalDate.of(2025, 3, 31), "6421.00", "26.50", "4280.00")))
                .build());

        ipos.add(SampleIpo.builder()
                .companyName("Life Insurance Corporation of India Ltd").domain("licindia.in")
                .ipoType("mainboard").status("listed")
                .openDate(today.minusDays(25)).closeDate(today.minusDays(22))
                .allotmentDate(today.minusDays(19)).listingDate(today.minusDays(15))
                .priceMin(new BigDecimal("902.00")).priceMax(new BigDecimal("949.00"))
                .lotSize(15).issueSize("₹21,000 Cr").listingExchange("BOTH")
                .listingPrice(new BigDecimal("867.20")).listingGainPct(new BigDecimal("-8.62"))
                .gmp(new BigDecimal("-2.00")).gmpPct(new BigDecimal("-0.21")).subTotal(new BigDecimal("2.96"))
                .allotmentStatus("finalized")
                .registrar("KFin Technologies").registrarUrl("https://kprism.kfintech.com/ipostatus/")
                .faceValue(new BigDecimal("10.00")).freshIssue(BigDecimal.ZERO).offerForSale(new BigDecimal("21000.00"))
                .tickerSymbol("LICI")
                .foundedYear(1956).managingDirector("Siddhartha Mohanty").parentCompany("Government of India")
                .sector("Insurance").headquarters("Mumbai").website("https://licindia.in")
                .about("LIC is India's largest life insurer by premium and assets under management, with an "
                        + "unmatched tied-agency distribution network built over six decades.")
                .strengths(bullets(
                        "India's largest life insurer by premium and AUM, with an unmatched agent network",
                        "Strong brand trust built over six decades, especially in semi-urban and rural India",
                        "Diversified product mix across participating and non-participating policies",
                        "Large embedded value and investment portfolio backing solvency"))
                .risks(bullets(
                        "Losing market share to faster-growing private insurers with higher-margin products",
                        "Heavily dependent on the traditional tied-agency channel versus digital-first rivals",
                        "Regulatory/government-ownership overhang can weigh on strategic flexibility",
                        "Product mix skewed toward lower-margin participating policies"))
                .financials(List.of(
                        fy("FY 2022-23", LocalDate.of(2023, 3, 31), "210300.00", "36397.00", "4300000.00"),
                        fy("FY 2023-24", LocalDate.of(2024, 3, 31), "231392.00", "40916.00", "4600000.00"),
                        fy("FY 2024-25", LocalDate.of(2025, 3, 31), "246500.00", "43809.00", "4950000.00")))
                .seedTradingHistory(true)
                .subscriptionCategoryWeights(licCategoryWeights())
                .build());

        // ── Open (2): a few days into the subscription window ───────────────────────────────
        ipos.add(SampleIpo.builder()
                .companyName("Ola Electric Mobility Ltd").domain("olaelectric.com").ipoType("mainboard").status("open")
                .openDate(today.minusDays(2)).closeDate(today.plusDays(2))
                .priceMin(new BigDecimal("72.00")).priceMax(new BigDecimal("76.00"))
                .lotSize(197).issueSize("₹6,145 Cr").listingExchange("BOTH")
                .gmp(new BigDecimal("8.00")).gmpPct(new BigDecimal("10.53")).subTotal(new BigDecimal("4.20"))
                .registrar("KFin Technologies").registrarUrl("https://kprism.kfintech.com/ipostatus/")
                .faceValue(new BigDecimal("10.00")).freshIssue(new BigDecimal("5500.00")).offerForSale(new BigDecimal("645.00"))
                .foundedYear(2017).managingDirector("Bhavish Aggarwal").parentCompany(null)
                .sector("Electric Vehicles").headquarters("Bengaluru").website("https://www.olaelectric.com")
                .about("Ola Electric is India's largest electric two-wheeler manufacturer by volume, with "
                        + "vertically integrated manufacturing including in-house battery-cell development.")
                .strengths(bullets(
                        "Largest electric two-wheeler manufacturer in India by volume",
                        "Vertically integrated manufacturing including in-house cell/battery development",
                        "Extensive direct-to-consumer retail and service network",
                        "First-mover scale advantage in a fast-growing EV two-wheeler category"))
                .risks(bullets(
                        "Continuing losses with a long runway to profitability given heavy capex",
                        "Execution risk in scaling battery-cell (Gigafactory) manufacturing",
                        "After-sales service and product-quality complaints reported by customers",
                        "Sensitive to changes in government EV subsidies (FAME/state policies)"))
                .financials(List.of(
                        fy("FY 2022-23", LocalDate.of(2023, 3, 31), "1242.20", "-1472.10", "2100.00"),
                        fy("FY 2023-24", LocalDate.of(2024, 3, 31), "5010.00", "-1584.40", "4800.00"),
                        fy("FY 2024-25", LocalDate.of(2025, 3, 31), "4500.00", "-650.00", "5600.00"),
                        interimFy(today, "4700.00", "-580.00", "6000.00")))
                .seedTradingHistory(true)
                .build());

        ipos.add(SampleIpo.builder()
                .companyName("Swiggy Ltd").domain("swiggy.com").ipoType("mainboard").status("open")
                .openDate(today.minusDays(1)).closeDate(today.plusDays(3))
                .priceMin(new BigDecimal("371.00")).priceMax(new BigDecimal("390.00"))
                .lotSize(38).issueSize("₹11,327 Cr").listingExchange("BOTH")
                .gmp(new BigDecimal("15.00")).gmpPct(new BigDecimal("3.85")).subTotal(new BigDecimal("3.59"))
                .registrar("Link Intime India").registrarUrl("https://linkintime.co.in/MIPO/ipoallotment.html")
                .faceValue(new BigDecimal("1.00")).freshIssue(new BigDecimal("4499.00")).offerForSale(new BigDecimal("6828.00"))
                .foundedYear(2014).managingDirector("Sriharsha Majety").parentCompany(null)
                .sector("Foodtech & Quick-commerce").headquarters("Bengaluru").website("https://www.swiggy.com")
                .about("Swiggy is one of India's two leading food-delivery platforms, with a fast-growing "
                        + "Instamart quick-commerce business alongside dineout and logistics bets.")
                .strengths(bullets(
                        "One of India's two leading food-delivery platforms with a growing Instamart business",
                        "Strong brand recognition and deep penetration across metro and tier-1/2 cities",
                        "Diversified into dineout, logistics and B2B supply alongside core delivery",
                        "Large, engaged user base with cross-sell potential across verticals"))
                .risks(bullets(
                        "Persistent losses; quick-commerce expansion is capital intensive",
                        "Intense, well-funded competition from Zomato/Blinkit and Zepto",
                        "Delivery-partner cost and regulatory risk around gig-work classification",
                        "Discounting-led growth could pressure long-term unit economics"))
                .financials(List.of(
                        fy("FY 2022-23", LocalDate.of(2023, 3, 31), "8264.60", "-4179.30", "7200.00"),
                        fy("FY 2023-24", LocalDate.of(2024, 3, 31), "11634.60", "-2350.00", "9800.00"),
                        fy("FY 2024-25", LocalDate.of(2025, 3, 31), "15227.00", "-1600.00", "12400.00")))
                .build());

        // ── Closed (1): allotment awaited, hugely oversubscribed SME ─────────────────────────
        ipos.add(SampleIpo.builder()
                .companyName("Nazara Technologies Ltd").domain("nazara.com").ipoType("sme").status("closed")
                .openDate(today.minusDays(6)).closeDate(today.minusDays(3)).allotmentDate(today.plusDays(1))
                .priceMin(new BigDecimal("1100.00")).priceMax(new BigDecimal("1101.00"))
                .lotSize(12).issueSize("₹583 Cr").listingExchange("NSE")
                .gmp(new BigDecimal("250.00")).gmpPct(new BigDecimal("22.71")).subTotal(new BigDecimal("175.46"))
                .allotmentStatus("awaited")
                .registrar("Bigshare Services").registrarUrl("https://ipo.bigshareonline.com/ipo_status.html")
                .faceValue(new BigDecimal("4.00")).freshIssue(BigDecimal.ZERO).offerForSale(new BigDecimal("583.00"))
                .foundedYear(1999).managingDirector("Nitish Mittersain").parentCompany(null)
                .sector("Gaming & Esports").headquarters("Mumbai").website("https://www.nazara.com")
                .about("Nazara Technologies runs a diversified gaming and sports-media portfolio spanning "
                        + "esports, real-money gaming and edutainment, built through a series of acquisitions.")
                .strengths(bullets(
                        "Diversified gaming and sports-media portfolio spanning esports, RMG and edutainment",
                        "Track record of value-accretive acquisitions across gaming sub-segments",
                        "Exposure to India's fast-growing mobile-gaming and esports viewership",
                        "Debt-free balance sheet with a cash-generative core business"))
                .risks(bullets(
                        "Regulatory uncertainty around online/real-money gaming taxation and rules",
                        "Revenue spread across many small subsidiaries, making consolidated execution complex",
                        "Success depends on hit-driven content and continued acquisition integration",
                        "Competitive, fast-changing mobile-gaming landscape"))
                .financials(List.of(
                        fy("FY 2022-23", LocalDate.of(2023, 3, 31), "1102.60", "5.10", "1450.00"),
                        fy("FY 2023-24", LocalDate.of(2024, 3, 31), "1166.70", "33.30", "1690.00"),
                        fy("FY 2024-25", LocalDate.of(2025, 3, 31), "1387.00", "45.20", "1980.00")))
                .build());

        // ── Upcoming (2): opens 7-15 days from now, no market data yet ──────────────────────
        ipos.add(SampleIpo.builder()
                .companyName("Honasa Consumer Ltd").domain("mamaearth.in").ipoType("sme").status("upcoming")
                .openDate(today.plusDays(7)).closeDate(today.plusDays(10))
                .priceMin(new BigDecimal("300.00")).priceMax(new BigDecimal("324.00"))
                .lotSize(46).issueSize("₹1,701 Cr").listingExchange("NSE")
                .registrar("Bigshare Services").registrarUrl("https://ipo.bigshareonline.com/ipo_status.html")
                .faceValue(new BigDecimal("10.00")).freshIssue(new BigDecimal("365.00")).offerForSale(new BigDecimal("1336.00"))
                .foundedYear(2016).managingDirector("Varun Alagh").parentCompany(null)
                .sector("Beauty & Personal Care").headquarters("Gurugram").website("https://www.mamaearth.in")
                .about("Honasa Consumer (Mamaearth) builds a house of \"clean and toxin-free\" D2C beauty and "
                        + "personal-care brands, marketed through a digital-first, social-led engine.")
                .strengths(bullets(
                        "Portfolio of fast-growing \"clean and toxin-free\" D2C beauty and personal-care brands",
                        "Digital-first marketing engine with strong social-media-led customer acquisition",
                        "Multi-brand \"house of brands\" strategy diversifies revenue beyond the flagship brand",
                        "Asset-light, contract-manufacturing model keeps capex low"))
                .risks(bullets(
                        "High reliance on marketing spend to sustain growth and brand recall",
                        "Intensifying competition from both legacy FMCG players and new D2C entrants",
                        "Thin/volatile profitability track record",
                        "Customer loyalty in D2C beauty can be fickle and trend-driven"))
                .financials(List.of(
                        fy("FY 2022-23", LocalDate.of(2023, 3, 31), "1492.90", "110.20", "1180.00"),
                        fy("FY 2023-24", LocalDate.of(2024, 3, 31), "1919.90", "110.50", "1520.00"),
                        fy("FY 2024-25", LocalDate.of(2025, 3, 31), "2144.00", "122.00", "1780.00")))
                .build());

        ipos.add(SampleIpo.builder()
                .companyName("One97 Communications Ltd").domain("paytm.com").ipoType("mainboard").status("upcoming")
                .openDate(today.plusDays(12)).closeDate(today.plusDays(15))
                .priceMin(new BigDecimal("2080.00")).priceMax(new BigDecimal("2150.00"))
                .lotSize(6).issueSize("₹18,300 Cr").listingExchange("NSE")
                .registrar("Link Intime India").registrarUrl("https://linkintime.co.in/MIPO/ipoallotment.html")
                .faceValue(new BigDecimal("1.00")).freshIssue(new BigDecimal("8300.00")).offerForSale(new BigDecimal("10000.00"))
                .foundedYear(2000).managingDirector("Vijay Shekhar Sharma").parentCompany(null)
                .sector("Digital Payments & Fintech").headquarters("Noida").website("https://paytm.com")
                .about("One97 Communications (Paytm) is a leading digital-payments brand in India, expanding "
                        + "from payments into lending, wealth and insurance distribution.")
                .strengths(bullets(
                        "Leading digital-payments brand in India with a large registered merchant and consumer base",
                        "Diversified into lending, wealth and insurance distribution beyond payments",
                        "Extensive offline merchant QR/soundbox network drives payment-volume stickiness",
                        "Deep data footprint across India's digital-payments ecosystem"))
                .risks(bullets(
                        "History of losses; the payments business carries thin/negative take rates",
                        "Regulatory actions (RBI restrictions on group entities) pose an ongoing overhang",
                        "Intense competition from PhonePe, Google Pay and bank-led UPI apps",
                        "Dependent on continued growth of higher-margin lending-distribution revenue"))
                .financials(List.of(
                        fy("FY 2022-23", LocalDate.of(2023, 3, 31), "7990.10", "-1776.50", "8900.00"),
                        fy("FY 2023-24", LocalDate.of(2024, 3, 31), "9977.80", "-1422.40", "10200.00"),
                        fy("FY 2024-25", LocalDate.of(2025, 3, 31), "10630.00", "-950.00", "11500.00")))
                .build());

        return ipos;
    }

    /** One entry in the builder list above — plain data, converted to an entity by {@link #toEntity}. */
    @Getter
    @Builder
    private static class SampleIpo {
        private String companyName;
        /** Bare domain (e.g. {@code "zomato.com"}) — used both for the Clearbit {@code logoUrl} and stored verbatim as {@code logoDomain} for the frontend's Logo.dev lookup. */
        private String domain;
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
        private BigDecimal faceValue;
        private BigDecimal freshIssue;
        private BigDecimal offerForSale;
        private String tickerSymbol;
        private String strengths;
        private String risks;
        private boolean seedTradingHistory;
        /** Category → weight-of-total split for seeded subscription history; {@code null} = {@link #defaultCategoryWeights()}. */
        private Map<String, Double> subscriptionCategoryWeights;
        private List<FinancialRow> financials;

        // ── Company "About" profile facts (seeder-populated; see IpoListingEntity) ──────────
        private Integer foundedYear;
        private String managingDirector;
        private String parentCompany;
        private String sector;
        private String headquarters;
        private String website;
    }

    /**
     * One financial-statement row for the seeder's own use — carries {@code periodEnd} (the
     * entity's chronological sort key) alongside the display/figure fields. Deliberately not
     * {@code IpoFinancialDto}: that record is the API's read shape and has no {@code periodEnd}.
     */
    private record FinancialRow(String fiscalYear, BigDecimal revenue, BigDecimal pat,
                                 BigDecimal totalAssets, LocalDate periodEnd) {}
}
