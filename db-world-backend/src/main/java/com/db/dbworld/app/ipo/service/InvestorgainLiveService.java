package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.ipo.entity.IpoChangeEventEntity;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.repository.IpoChangeEventRepository;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.app.ipo.source.support.IpoHttpClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.log4j.Log4j2;

import org.jsoup.Jsoup;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.db.dbworld.app.ipo.source.support.IpoJsonUtil.text;

/**
 * The LIVE tier: refreshes the fast-moving IPO numbers from investorgain in TWO HTTP calls total,
 * on its own (much shorter) schedule than the source poll.
 *
 * <p>This replaces the per-IPO fetch loop that used to supply the card's headline figures. That
 * loop needed one call per IPO against a 30-call budget while the report matched ~155 tracked
 * IPOs, so the issues actually on screen could end up with no GMP and no subscription at all.
 * Report 331 carries all of it for every current IPO in a single response, so there is no budget
 * to starve:
 * <ul>
 *   <li>{@code report/data-read/331/…} — GMP + its low/high range, subscription multiple, market
 *       lot, P/E, cap price, issue size, all four timeline dates, anchor-investor flag, a GMP
 *       "updated on" label, and — for rows that have already listed — the listing price and gain
 *       encoded in the name cell as {@code L@185.00 (15.62%)}.</li>
 *   <li>{@code index/gmp-data} — the same IPOs with the two things report 331 omits: the full
 *       {@code price_band} (331 gives only the cap) and the registrar's {@code allotment_link},
 *       plus the sector and a numeric GMP rating.</li>
 * </ul>
 *
 * <p><b>Nothing here is calculated.</b> Investorgain publishes the percentages, the estimated
 * listing price and the profit estimate, so those are stored exactly as reported. The only
 * transformation is pulling values out of the HTML fragments their report embeds in JSON.
 *
 * <p><b>Scope of what it writes.</b> Investorgain wins only the volatile fields — GMP, subscription,
 * rating, lot, listing price/gain, P/E. NSE remains the exchange of record for dates, status and
 * the price band, so those are filled ONLY where we have nothing. Status is never touched: the
 * ingest lifecycle owns it (and drives the push notifications off it).
 *
 * <p><b>It also emits its own change events.</b> {@code IpoIngestService.detectChanges} spots a GMP
 * move by comparing the incoming feed against what's stored — so once this tier started writing
 * {@code gmp} every half hour, the two-hourly poll always found them already equal and stopped
 * raising GMP events entirely, silently killing the "GMP moved" push. Whichever tier writes the
 * value has to be the one that records the change, so this one does.
 *
 * <p>Best-effort throughout: any failure is logged and swallowed so it can never break the caller.
 */
@Log4j2
@Service
public class InvestorgainLiveService {

    private static final String SOURCE = "investorgain";
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private static final String DEFAULT_BASE_URL = "https://webnodejs.investorgain.com";
    /**
     * The "live GMP" report. Segments are {@code report-id / page / MONTH / year / FY / 0 / tab} —
     * note the third one is the calendar month (confirmed by the response's own
     * {@code cacheKey: "ig_report_v2:331:all:1::2026:8:2026-27:"}), not a constant.
     */
    private static final String LIVE_REPORT_PATH = "/cloud/v2/report/data-read/331/1/%d/%d/%s/0/all?search=";
    /** The GMP dashboard — price band + allotment link + sector, for every current IPO. */
    private static final String GMP_DASHBOARD_PATH = "/cloud/v2/index/gmp-data";
    /**
     * Per-IPO GMP detail. The only place the three grey-market estimates appear — neither the live
     * report nor the dashboard carries them — so they need one call per IPO. {@code
     * InvestorgainGmpService} calls the same endpoint for the day-wise history; this reads only the
     * latest row's estimates, so the two take different slices of the same response rather than one
     * depending on the other.
     */
    private static final String GMP_DETAIL_PATH = "/cloud/v2/ipo/ipo-gmp-read/%d/true";

    /**
     * Hard cap on per-IPO estimate fetches per pass. Rarely reached: a call is only spent when the
     * GMP actually moved this pass or the estimates are still missing (see
     * {@link #needsEstimates(IpoListingEntity, LiveRow)}), which on a typical half-hourly tick is a
     * handful of IPOs rather than all thirty.
     */
    private static final int MAX_ESTIMATE_FETCHES = 12;

    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    private static final String INVESTORGAIN_ORIGIN = "https://www.investorgain.com";

    // ── Report 331 field names (verbatim from a live capture — the '~' prefixes and the ₹ in
    //    "Price (₹)" are literal parts of the keys) ────────────────────────────────────────────
    private static final String F_ROWS = "reportTableData";
    private static final String F_ID = "~id";
    private static final String F_NAME_HTML = "Name";
    private static final String F_IPO_NAME = "~ipo_name";
    private static final String F_GMP_HTML = "GMP";
    private static final String F_RATING_HTML = "Rating";
    private static final String F_SUB = "Sub";
    private static final String F_PRICE = "Price (₹)";
    private static final String F_ISSUE_SIZE = "IPO Size";
    private static final String F_LOT = "Lot";
    private static final String F_PE = "~P/E";
    private static final String F_UPDATED_ON = "Updated-On";
    private static final String F_ANCHOR = "Anchor";
    private static final String F_OPEN = "~Srt_Open";
    private static final String F_CLOSE = "~Srt_Close";
    private static final String F_BOA = "~Srt_BoA_Dt";
    private static final String F_LISTING = "~Str_Listing";

    // ── GMP dashboard field names ───────────────────────────────────────────────────────────────
    private static final String F_GMP_LIST = "gmpList";
    private static final String F_HREF = "href";
    private static final String F_PRICE_BAND = "price_band";
    private static final String F_ALLOTMENT_LINK = "allotment_link";
    private static final String F_SECTOR = "company_sector";
    private static final String F_GMP_RATING = "gmp_rating";
    private static final String F_LOGO_URL = "logo_url";

    /**
     * Where investorgain's bare {@code logo_url} filenames resolve to. Their dashboard reports the
     * file only (e.g. {@code "deepa-jewellers-ipo-logo.png"}) and serves the images off Chittorgarh's
     * CDN, so the host has to be prepended. A value that already looks absolute is passed through
     * untouched, in case they ever start sending full URLs.
     */
    private static final String LOGO_BASE_URL = "https://www.chittorgarh.net/images/ipo/";

    // ── Per-IPO GMP detail field names (the grey-market estimates, all AS REPORTED) ─────────────
    private static final String F_GMP_DETAIL_ROWS = "ipoGmpData";
    private static final String F_GMP_ACTIVE = "gmp_active_record_flag";
    private static final String F_EST_LISTING_PRICE = "estimated_listing_price";
    private static final String F_SUBJECT_TO_SAUDA = "subject_to_sauda";
    private static final String F_EST_PROFIT = "est_profit";

    /** {@code ₹<b>18.5</b> (11.56%)} — the current GMP and its percentage. */
    private static final Pattern GMP_VALUE = Pattern.compile("<b>\\s*(-?[\\d.]+)\\s*</b>");
    private static final Pattern PERCENT = Pattern.compile("\\(\\s*(-?[\\d.]+)\\s*%\\s*\\)");
    /** {@code <b>7 ↓ / 30 ↑</b>} — the low/high GMP range for the cycle. */
    private static final Pattern GMP_RANGE = Pattern.compile("(-?[\\d.]+)\\s*↓\\s*/\\s*(-?[\\d.]+)\\s*↑");
    /** {@code L@185.00 (15.62%)} — present in the name cell only once the shares have listed. */
    private static final Pattern LISTED_AT = Pattern.compile("L@\\s*(-?[\\d.]+)\\s*\\(\\s*(-?[\\d.]+)\\s*%\\s*\\)");
    /** Their rating is a run of fire emoji; the count IS the rating. */
    private static final String FIRE_ENTITY = "&#128293;";
    /** {@code 1.51x} / {@code 247.39x} in the Sub column ("-" when bidding hasn't started). */
    private static final Pattern SUBSCRIPTION = Pattern.compile("(-?[\\d.]+)\\s*x", Pattern.CASE_INSENSITIVE);
    /** The id in an investorgain href, e.g. {@code /ipo/lumino-industries-ipo/1619/}. */
    private static final Pattern HREF_ID = Pattern.compile("/(\\d+)/?$");
    private static final Pattern INTEGER = Pattern.compile("\\d+");

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final IpoHttpClient httpClient;
    private final IpoListingRepository listingRepo;
    private final IpoChangeEventRepository changeEventRepo;
    private final InvestorgainMatcher matcher;
    private final IpoSourcePollService pollService;
    private final SettingsService settingsService;
    private final Clock clock;

    @Autowired
    public InvestorgainLiveService(IpoHttpClient httpClient, IpoListingRepository listingRepo,
                                   IpoChangeEventRepository changeEventRepo, InvestorgainMatcher matcher,
                                   IpoSourcePollService pollService, SettingsService settingsService) {
        this(httpClient, listingRepo, changeEventRepo, matcher, pollService, settingsService, Clock.systemUTC());
    }

    /** Test-friendly constructor with an injectable clock for deterministic report URLs. */
    InvestorgainLiveService(IpoHttpClient httpClient, IpoListingRepository listingRepo,
                             IpoChangeEventRepository changeEventRepo, InvestorgainMatcher matcher,
                             IpoSourcePollService pollService, SettingsService settingsService, Clock clock) {
        this.httpClient = httpClient;
        this.listingRepo = listingRepo;
        this.changeEventRepo = changeEventRepo;
        this.matcher = matcher;
        this.pollService = pollService;
        this.settingsService = settingsService;
        this.clock = clock;
    }

    /**
     * One live refresh. Returns the number of listings actually changed — zero is the normal
     * outcome between GMP updates, since every field is written only when it differs.
     */
    @Transactional
    public int refresh() {
        try {
            List<LiveRow> rows = parseLiveReport(fetch(liveReportUrl()));
            if (rows.isEmpty()) {
                log.warn("investorgain live: report returned no rows — nothing refreshed");
                pollService.recordFailure(SOURCE, clock.instant(), "EMPTY");
                return 0;
            }
            Map<Integer, DashboardRow> dashboard = fetchDashboard();
            InvestorgainMatcher.Index index = matcher.loadIndex();

            int updated = 0;
            int unmatched = 0;
            int estimateFetches = 0;
            for (LiveRow row : rows) {
                IpoListingEntity entity = matcher.resolve(index, row.id(), row.companyName(), row.openDate());
                if (entity == null) {
                    unmatched++;
                    continue;
                }
                // The grey-market estimates cost a call each, so only go and get them when this pass
                // moved the GMP they're derived from (or we've never had them at all).
                Estimates estimates = null;
                if (estimateFetches < MAX_ESTIMATE_FETCHES && needsEstimates(entity, row)) {
                    estimates = fetchEstimates(row.id());
                    estimateFetches++;
                }
                if (apply(entity, row, dashboard.get(row.id()), estimates)) {
                    listingRepo.save(entity);
                    updated++;
                }
            }
            pollService.recordSuccess(SOURCE, clock.instant());
            log.info("investorgain live: reportRows={} dashboardRows={} matched={} updated={} "
                    + "estimateFetches={} unmatched={}",
                    rows.size(), dashboard.size(), rows.size() - unmatched, updated, estimateFetches, unmatched);
            return updated;
        } catch (Exception e) {
            log.warn("investorgain live refresh failed: {}", e.toString());
            pollService.recordFailure(SOURCE, clock.instant(), "FAILED");
            return 0;
        }
    }

    /**
     * The live-report URL for the current IST month. The month segment matters — the report is keyed
     * to it (see {@link #LIVE_REPORT_PATH}) — and the Indian financial year rolls over on 1 April,
     * so both are computed in IST rather than the clock's own zone.
     */
    String liveReportUrl() {
        ZonedDateTime nowIst = ZonedDateTime.now(clock.withZone(IST));
        int fyStart = nowIst.getMonthValue() >= 4 ? nowIst.getYear() : nowIst.getYear() - 1;
        String fyLabel = fyStart + "-" + String.format(Locale.ROOT, "%02d", (fyStart + 1) % 100);
        return (baseUrl() + LIVE_REPORT_PATH).formatted(nowIst.getMonthValue(), fyStart, fyLabel);
    }

    private String baseUrl() {
        String configured = settingsService.getString(ConfigKeys.IPO_INVESTORGAIN_BASE_URL);
        String base = (configured == null || configured.isBlank()) ? DEFAULT_BASE_URL : configured.trim();
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    private String fetch(String url) {
        return httpClient.get(url, Map.of(
                HttpHeaders.USER_AGENT, USER_AGENT,
                HttpHeaders.ACCEPT, "application/json, text/plain, */*",
                HttpHeaders.REFERER, INVESTORGAIN_ORIGIN + "/",
                HttpHeaders.ORIGIN, INVESTORGAIN_ORIGIN)).body();
    }

    /** The dashboard is a bonus call: a failure just means no price band / allotment link this pass. */
    private Map<Integer, DashboardRow> fetchDashboard() {
        try {
            return parseDashboard(fetch(baseUrl() + GMP_DASHBOARD_PATH));
        } catch (Exception e) {
            log.warn("investorgain live: GMP dashboard fetch failed (price band + allotment link skipped): {}",
                    e.toString());
            return Map.of();
        }
    }

    // ── Parsing ─────────────────────────────────────────────────────────────────────────────────

    /** One report-331 row, already decoded out of its HTML fragments. */
    record LiveRow(Integer id, String companyName, BigDecimal gmp, BigDecimal gmpPct, BigDecimal gmpMin,
                   BigDecimal gmpMax, Integer gmpRating, BigDecimal subTotal, BigDecimal capPrice,
                   String issueSize, Integer lotSize, BigDecimal peRatio, String gmpUpdatedLabel,
                   Boolean anchorInvestor, BigDecimal listingPrice, BigDecimal listingGainPct,
                   LocalDate openDate, LocalDate closeDate, LocalDate allotmentDate, LocalDate listingDate) {}

    /** The dashboard's extras for one IPO. */
    record DashboardRow(BigDecimal priceMin, BigDecimal priceMax, String allotmentLink, String sector,
                        Integer gmpRating, String logoUrl) {}

    /** Extracted for unit testing without HTTP. */
    List<LiveRow> parseLiveReport(String body) {
        List<LiveRow> rows = new ArrayList<>();
        try {
            JsonNode array = MAPPER.readTree(body).path(F_ROWS);
            if (!array.isArray()) {
                log.warn("investorgain live: response has no '{}' array", F_ROWS);
                return rows;
            }
            for (JsonNode node : array) {
                Integer id = firstInteger(text(node, F_ID));
                if (id == null) {
                    continue; // nothing to key on
                }
                String gmpHtml = text(node, F_GMP_HTML);
                BigDecimal[] range = matchPair(GMP_RANGE, gmpHtml);
                BigDecimal[] listed = matchPair(LISTED_AT, text(node, F_NAME_HTML));
                rows.add(new LiveRow(
                        id,
                        firstNonBlank(text(node, F_IPO_NAME), anchorText(text(node, F_NAME_HTML))),
                        firstDecimal(GMP_VALUE, gmpHtml),
                        firstDecimal(PERCENT, gmpHtml),
                        range == null ? null : range[0],
                        range == null ? null : range[1],
                        fireRating(text(node, F_RATING_HTML)),
                        firstDecimal(SUBSCRIPTION, text(node, F_SUB)),
                        decimalOf(text(node, F_PRICE)),
                        blankToNull(text(node, F_ISSUE_SIZE)),
                        firstInteger(text(node, F_LOT)),
                        decimalOf(text(node, F_PE)),
                        blankToNull(plainText(text(node, F_UPDATED_ON))),
                        anchorFlag(text(node, F_ANCHOR)),
                        listed == null ? null : listed[0],
                        listed == null ? null : listed[1],
                        isoDate(text(node, F_OPEN)),
                        isoDate(text(node, F_CLOSE)),
                        isoDate(text(node, F_BOA)),
                        isoDate(text(node, F_LISTING))));
            }
        } catch (Exception e) {
            log.warn("investorgain live: report parse failed: {}", e.toString());
        }
        return rows;
    }

    /** Extracted for unit testing without HTTP — keyed by the investorgain id in each row's href. */
    Map<Integer, DashboardRow> parseDashboard(String body) {
        Map<Integer, DashboardRow> byId = new HashMap<>();
        try {
            JsonNode array = MAPPER.readTree(body).path(F_GMP_LIST);
            if (!array.isArray()) {
                return byId;
            }
            for (JsonNode node : array) {
                Integer id = hrefId(text(node, F_HREF));
                if (id == null) {
                    continue;
                }
                BigDecimal[] band = priceBand(text(node, F_PRICE_BAND));
                byId.put(id, new DashboardRow(band[0], band[1],
                        blankToNull(text(node, F_ALLOTMENT_LINK)),
                        blankToNull(text(node, F_SECTOR)),
                        firstInteger(text(node, F_GMP_RATING)),
                        logoUrl(text(node, F_LOGO_URL))));
            }
        } catch (Exception e) {
            log.warn("investorgain live: dashboard parse failed: {}", e.toString());
        }
        return byId;
    }

    // ── Applying ────────────────────────────────────────────────────────────────────────────────

    /**
     * Copies one row onto its listing, returning whether anything actually changed (so an unchanged
     * pass issues no writes at all).
     *
     * <p>Two different rules apply, per the agreed merge precedence: the volatile numbers OVERWRITE
     * whatever is stored, while dates, the price band and the issue size only FILL A GAP — NSE stays
     * the exchange of record for those.
     */
    private boolean apply(IpoListingEntity e, LiveRow row, DashboardRow dash, Estimates estimates) {
        boolean changed = false;

        // Captured BEFORE the writes below, because this tier owns change detection for the fields
        // it overwrites — see the class javadoc for why the poll can no longer see these moves.
        BigDecimal previousGmp = e.getGmp();
        boolean listingPriceWasUnknown = e.getListingPrice() == null;

        // Volatile — investorgain wins outright.
        changed |= setIfDifferent(row.gmp(), e.getGmp(), e::setGmp);
        changed |= setIfDifferent(row.gmpPct(), e.getGmpPct(), e::setGmpPct);
        changed |= setIfDifferent(row.gmpMin(), e.getGmpMin(), e::setGmpMin);
        changed |= setIfDifferent(row.gmpMax(), e.getGmpMax(), e::setGmpMax);
        changed |= setIfDifferent(row.subTotal(), e.getSubTotal(), e::setSubTotal);
        changed |= setIfDifferent(row.peRatio(), e.getPeRatio(), e::setPeRatio);
        changed |= setIfDifferent(row.listingPrice(), e.getListingPrice(), e::setListingPrice);
        changed |= setIfDifferent(row.listingGainPct(), e.getListingGainPct(), e::setListingGainPct);
        changed |= setObjectIfDifferent(row.lotSize(), e.getLotSize(), e::setLotSize);
        changed |= setObjectIfDifferent(row.anchorInvestor(), e.getAnchorInvestor(), e::setAnchorInvestor);
        changed |= setObjectIfDifferent(row.gmpUpdatedLabel(), e.getGmpUpdatedLabel(), e::setGmpUpdatedLabel);
        // The dashboard's numeric rating is preferred over counting emoji in the report's markup.
        Integer rating = dash != null && dash.gmpRating() != null ? dash.gmpRating() : row.gmpRating();
        changed |= setObjectIfDifferent(rating, e.getGmpRating(), e::setGmpRating);

        // Gap-fill only — NSE owns dates and pricing.
        changed |= fillIfAbsent(row.openDate(), e.getOpenDate(), e::setOpenDate);
        changed |= fillIfAbsent(row.closeDate(), e.getCloseDate(), e::setCloseDate);
        changed |= fillIfAbsent(row.allotmentDate(), e.getAllotmentDate(), e::setAllotmentDate);
        changed |= fillIfAbsent(row.listingDate(), e.getListingDate(), e::setListingDate);
        changed |= fillIfAbsent(row.issueSize(), e.getIssueSize(), e::setIssueSize);
        // 331 reports only the cap, so it can seed priceMax but never a band.
        changed |= fillIfAbsent(row.capPrice(), e.getPriceMax(), e::setPriceMax);

        if (dash != null) {
            changed |= fillIfAbsent(dash.priceMin(), e.getPriceMin(), e::setPriceMin);
            changed |= fillIfAbsent(dash.priceMax(), e.getPriceMax(), e::setPriceMax);
            changed |= fillIfAbsent(dash.sector(), e.getSector(), e::setSector);
            // Gap-fill only: Chittorgarh's ~compare_image is already a full URL and stays preferred.
            changed |= fillIfAbsent(dash.logoUrl(), e.getLogoUrl(), e::setLogoUrl);
            changed |= setObjectIfDifferent(dash.allotmentLink(), e.getAllotmentLink(), e::setAllotmentLink);
        }
        if (estimates != null) {
            changed |= setIfDifferent(estimates.estimatedListingPrice(), e.getEstimatedListingPrice(),
                    e::setEstimatedListingPrice);
            changed |= setIfDifferent(estimates.subjectToSauda(), e.getSubjectToSauda(), e::setSubjectToSauda);
            changed |= setIfDifferent(estimates.estProfit(), e.getEstProfit(), e::setEstProfit);
        }

        recordChanges(e, previousGmp, listingPriceWasUnknown);
        return changed;
    }

    /**
     * Appends the change events for whatever this pass moved, so the audit feed and the push queue
     * both still see it. A GMP event is what {@code IpoNotificationService} turns into the "GMP
     * moved" alert (subject to its own percentage threshold); the LISTING event is audit-only.
     */
    private void recordChanges(IpoListingEntity e, BigDecimal previousGmp, boolean listingPriceWasUnknown) {
        Instant now = clock.instant();
        if (e.getGmp() != null && (previousGmp == null || previousGmp.compareTo(e.getGmp()) != 0)) {
            changeEventRepo.save(IpoChangeEventEntity.builder()
                    .ipoId(e.getId()).eventType("GMP")
                    .oldValue(previousGmp == null ? null : previousGmp.toPlainString())
                    .newValue(e.getGmp().toPlainString())
                    .createdAt(now)
                    .build());
        }
        if (listingPriceWasUnknown && e.getListingPrice() != null) {
            changeEventRepo.save(IpoChangeEventEntity.builder()
                    .ipoId(e.getId()).eventType("LISTING")
                    .newValue(listingEventValue(e))
                    .createdAt(now)
                    .build());
        }
    }

    /** Mirrors the ingest service's LISTING value format: exchange then gain, space-joined. */
    private static String listingEventValue(IpoListingEntity e) {
        List<String> parts = new ArrayList<>();
        if (e.getListingExchange() != null) {
            parts.add(e.getListingExchange());
        }
        if (e.getListingGainPct() != null) {
            parts.add(e.getListingGainPct() + "%");
        }
        return String.join(" ", parts);
    }

    /**
     * Whether this IPO is worth a per-IPO call for the grey-market estimates. True when the GMP they
     * are derived from just moved, or when we simply don't have them yet — so a quiet half-hour
     * costs nothing and a first run backfills.
     */
    private static boolean needsEstimates(IpoListingEntity e, LiveRow row) {
        if (e.getEstimatedListingPrice() == null && e.getSubjectToSauda() == null && e.getEstProfit() == null) {
            return true;
        }
        return row.gmp() != null && (e.getGmp() == null || e.getGmp().compareTo(row.gmp()) != 0);
    }

    /** The three estimates from the latest row of one IPO's GMP detail. */
    record Estimates(BigDecimal estimatedListingPrice, BigDecimal subjectToSauda, BigDecimal estProfit) {}

    /** Best-effort: a failure here costs only the estimates, never the rest of the refresh. */
    private Estimates fetchEstimates(Integer investorgainId) {
        try {
            return parseEstimates(fetch((baseUrl() + GMP_DETAIL_PATH).formatted(investorgainId)));
        } catch (Exception e) {
            log.warn("investorgain live: estimate fetch failed for id {}: {}", investorgainId, e.toString());
            return null;
        }
    }

    /**
     * Extracted for unit testing without HTTP. Prefers the row investorgain flags as the active one
     * ({@code gmp_active_record_flag}); the history is newest-first, so the first row is the
     * fallback when nothing is flagged.
     */
    Estimates parseEstimates(String body) {
        try {
            JsonNode array = MAPPER.readTree(body).path(F_GMP_DETAIL_ROWS);
            if (!array.isArray() || array.isEmpty()) {
                return null;
            }
            JsonNode chosen = array.get(0);
            for (JsonNode node : array) {
                if ("1".equals(text(node, F_GMP_ACTIVE))) {
                    chosen = node;
                    break;
                }
            }
            return new Estimates(decimalOf(text(chosen, F_EST_LISTING_PRICE)),
                    decimalOf(text(chosen, F_SUBJECT_TO_SAUDA)),
                    decimalOf(text(chosen, F_EST_PROFIT)));
        } catch (Exception e) {
            log.warn("investorgain live: estimate parse failed: {}", e.toString());
            return null;
        }
    }

    private static boolean setIfDifferent(BigDecimal incoming, BigDecimal current,
                                          java.util.function.Consumer<BigDecimal> setter) {
        if (incoming == null || (current != null && current.compareTo(incoming) == 0)) {
            return false;
        }
        setter.accept(incoming);
        return true;
    }

    private static <T> boolean setObjectIfDifferent(T incoming, T current, java.util.function.Consumer<T> setter) {
        if (incoming == null || incoming.equals(current)) {
            return false;
        }
        setter.accept(incoming);
        return true;
    }

    private static <T> boolean fillIfAbsent(T incoming, T current, java.util.function.Consumer<T> setter) {
        if (incoming == null || current != null) {
            return false;
        }
        setter.accept(incoming);
        return true;
    }

    // ── Small parsing helpers ───────────────────────────────────────────────────────────────────

    /** Strips tags/entities out of one of the report's HTML cells. */
    private static String plainText(String html) {
        return html == null ? null : Jsoup.parseBodyFragment(html).text().trim();
    }

    /** The anchor text of a name cell — the fallback when {@code ~ipo_name} is absent. */
    private static String anchorText(String html) {
        if (html == null) {
            return null;
        }
        var anchor = Jsoup.parseBodyFragment(html).selectFirst("a");
        return anchor == null ? plainText(html) : anchor.text().trim();
    }

    /** Number of fire emoji in the rating cell — their rating is expressed as the count. */
    private static Integer fireRating(String html) {
        if (html == null) {
            return null;
        }
        int count = 0;
        int from = 0;
        while ((from = html.indexOf(FIRE_ENTITY, from)) >= 0) {
            count++;
            from += FIRE_ENTITY.length();
        }
        return count == 0 ? null : count;
    }

    /** {@code ✅} → true, {@code ❌} → false, anything else → null (unknown, not "no"). */
    private static Boolean anchorFlag(String html) {
        String plain = plainText(html);
        if (plain == null || plain.isEmpty()) {
            return null;
        }
        if (plain.contains("✅")) {
            return Boolean.TRUE;
        }
        return plain.contains("❌") ? Boolean.FALSE : null;
    }

    /** A bare logo filename resolved against {@link #LOGO_BASE_URL}; an absolute URL is left alone. */
    private static String logoUrl(String raw) {
        String file = blankToNull(raw);
        if (file == null) {
            return null;
        }
        return file.startsWith("http") ? file : LOGO_BASE_URL + file;
    }

    /** {@code "227-239"} → [227, 239]; a single {@code "59"} → [59, 59]; blank → [null, null]. */
    private static BigDecimal[] priceBand(String raw) {
        if (raw == null || raw.isBlank()) {
            return new BigDecimal[] {null, null};
        }
        String[] parts = raw.split("-");
        BigDecimal low = decimalOf(parts[0]);
        BigDecimal high = parts.length > 1 ? decimalOf(parts[1]) : low;
        return new BigDecimal[] {low, high};
    }

    private static BigDecimal firstDecimal(Pattern pattern, String raw) {
        if (raw == null) {
            return null;
        }
        Matcher m = pattern.matcher(raw);
        return m.find() ? decimalOf(m.group(1)) : null;
    }

    /** Both capture groups of the first match, or {@code null} when the pattern isn't present. */
    private static BigDecimal[] matchPair(Pattern pattern, String raw) {
        if (raw == null) {
            return null;
        }
        Matcher m = pattern.matcher(raw);
        return m.find() ? new BigDecimal[] {decimalOf(m.group(1)), decimalOf(m.group(2))} : null;
    }

    private static Integer hrefId(String href) {
        if (href == null) {
            return null;
        }
        Matcher m = HREF_ID.matcher(href.trim());
        return m.find() ? firstInteger(m.group(1)) : null;
    }

    private static Integer firstInteger(String raw) {
        if (raw == null) {
            return null;
        }
        Matcher m = INTEGER.matcher(raw.replace(",", ""));
        if (!m.find()) {
            return null;
        }
        try {
            return Integer.valueOf(m.group());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    /** Tolerant decimal read — their cells carry currency symbols, commas and {@code "--"} blanks. */
    private static BigDecimal decimalOf(String raw) {
        if (raw == null) {
            return null;
        }
        String cleaned = raw.replaceAll("[^0-9.-]", "").trim();
        if (cleaned.isEmpty() || "-".equals(cleaned) || cleaned.startsWith("--")) {
            return null;
        }
        try {
            return new BigDecimal(cleaned);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static LocalDate isoDate(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(raw.trim());
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private static String blankToNull(String raw) {
        return raw == null || raw.isBlank() ? null : raw.trim();
    }

    private static String firstNonBlank(String a, String b) {
        return blankToNull(a) != null ? a.trim() : blankToNull(b);
    }
}
