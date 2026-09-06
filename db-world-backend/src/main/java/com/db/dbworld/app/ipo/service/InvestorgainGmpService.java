package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.ipo.dto.SubscriptionCategoryDto;
import com.db.dbworld.app.ipo.entity.IpoGmpHistoryEntity;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.entity.IpoSubscriptionHistoryEntity;
import com.db.dbworld.app.ipo.repository.IpoGmpHistoryRepository;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.app.ipo.repository.IpoSubscriptionHistoryRepository;
import com.db.dbworld.app.ipo.source.support.IpoHttpClient;
import com.db.dbworld.app.ipo.source.support.IpoHttpResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.log4j.Log4j2;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static com.db.dbworld.app.ipo.source.support.IpoJsonUtil.text;

/**
 * Backfills grey-market-premium (GMP) history from <a href="https://www.investorgain.com">
 * investorgain</a>'s JSON API — the site Chittorgarh links out to for GMP — into
 * {@code ipo_gmp_history}, and stamps each matched listing's latest GMP.
 *
 * <p>Deliberately NOT an {@link com.db.dbworld.app.ipo.source.IpoSource}: GMP here is a day-wise
 * time series keyed to a provider-specific id, not the per-poll snapshot the source→merge→ingest
 * pipeline models. Instead {@link IpoPollScheduler} calls {@link #refreshGmp()} once AFTER ingest
 * (so listings — and their {@code matchKey}s — already exist), and this service:
 * <ol>
 *   <li>reads investorgain's live-subscription dashboard(s) to map its own IPO ids to a company +
 *       open date, then to one of OUR listings by {@link IpoNormalizer#matchKey(String, LocalDate)}
 *       (no HTTP spent on IPOs we don't track);</li>
 *   <li>for each matched listing, fetches that IPO's day-wise GMP and UPSERTs each day as an
 *       {@link IpoGmpHistoryEntity} row (idempotent — keyed by {@code (ipoId, capturedAt)} where
 *       {@code capturedAt} is the GMP date at UTC midnight, so re-runs don't duplicate);</li>
 *   <li>stamps the listing's {@code gmp}/{@code gmpPct} with the most recent day.</li>
 * </ol>
 *
 * <p>Best-effort throughout: any failure (network, anti-bot, shape change) is logged and swallowed
 * so it can never break the poll cycle it's called from. Per-IPO detail fetches are bounded by
 * {@link #MAX_GMP_FETCHES} and only spent on IPOs that matched a tracked listing.
 */
@Log4j2
@Service
public class InvestorgainGmpService {

    private static final String SOURCE = "investorgain";

    // ── Endpoints (confirmed from a live DevTools capture) ──────────────────────────────────────
    // The "report/data-read/394" list is the whole IPO calendar for the financial year (mainboard +
    // SME + REIT/InvIT, upcoming through recently-listed), each row carrying investorgain's own
    // ~id — so GMP can be resolved for UPCOMING issues too, not just the live-subscription
    // dashboard. Same FY-keyed shape as Chittorgarh's list: report-id(394)/page/7/fyStart/fy/0/all.
    // A configurable base URL (admin: ipo.investorgain.base-url) + these in-code path templates, so
    // the webnodejs host can be repointed without a redeploy. Blank/unset config falls back to
    // DEFAULT_BASE_URL, reproducing the original absolute URLs exactly.
    private static final String DEFAULT_BASE_URL = "https://webnodejs.investorgain.com";
    // Segments: report-id(394) / page / MONTH / fyStartYear / fyLabel / <const 0> / tab(all). That
    // third segment is the calendar month — confirmed by a sibling report echoing it back in its own
    // cacheKey ("ig_report_v2:331:all:1::2026:8:2026-27:") — not the constant it was once taken for.
    private static final String LIST_PATH_TEMPLATE = "/cloud/v2/report/data-read/394/%d/%d/%d/%s/0/all";
    private static final String GMP_PATH_TEMPLATE = "/cloud/v2/ipo/ipo-gmp-read/%s/true";
    // Day-wise category subscription (QIB/NII/S-NII/B-NII/RII/Employee/Shareholder/Other), keyed by
    // investorgain's own IPO id — persists the final numbers even after the issue closes (NSE drops
    // subscription once an issue is no longer "current"). Same webnodejs host as the GMP endpoints.
    private static final String SUBSCRIPTION_PATH_TEMPLATE = "/cloud/v2/ipo/ipo-subscription-read/%s";

    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    private static final String INVESTORGAIN_ORIGIN = "https://www.investorgain.com";
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    /** Cap on list pages walked per refresh (the report returns 500/page, so realistically one). */
    private static final int MAX_PAGES = 10;
    /** Cap on per-IPO GMP fetches per refresh — only spent on IPOs that matched a tracked listing. */
    private static final int MAX_GMP_FETCHES = 30;
    /** Cap on per-IPO subscription fetches per refresh — only spent on matched, tracked listings. */
    private static final int MAX_SUB_FETCHES = 30;
    /** Recent-listing window used when {@code ipo.list.hide-listed-after-days} is 0 ("never hide"). */
    private static final int DEFAULT_RECENT_LISTING_DAYS = 30;

    // ── Subscription-read fields ────────────────────────────────────────────────────────────────
    private static final String F_SUB_DATA = "data";
    private static final String F_SUB_BIDDING = "ipoBiddingData";
    private static final String F_SUB_CREATE_DATE = "create_date";       // ISO, e.g. "2026-07-27T19:05:00.000Z"
    private static final String F_SUB_COR_DATE = "cor_date_added";
    /** Their human "as of" label for the bidding figures, e.g. {@code "27th Aug 2026 17:11"}. */
    private static final String F_SUB_BID_DATE = "bid_date";       // ISO fallback for the day
    private static final String F_SUB_TOTAL = "total";                   // overall multiple, e.g. "72.37"
    /**
     * {@code {timesKey, offeredKey, sharesBidKey, bidAmtKey, displayLabel}} per subscription
     * category, in display order. A category is only recorded when its {@code *_offered} is present
     * and non-zero (so Employee / Shareholder / Other only appear for IPOs that actually have that
     * quota) — NII is split into Small (≤ ₹10L) and Big (> ₹10L) exactly as investorgain reports it.
     * Note the odd one out: shareholder's shares-bid key is {@code shareholder_shares_bid} (no {@code _for}).
     */
    private static final String[][] SUB_CATEGORIES = {
            {"qib",         "qib_offered",         "qib_shares_bid_for",       "qib_bid_amt",         "QIB"},
            {"nii",         "nii_offered",         "nii_shares_bid_for",       "nii_bid_amt",         "NII"},
            {"nii_small",   "nii_offered_small",   "nii_shares_bid_for_small", "nii_bid_amt_small",   "S-NII"},
            {"nii_big",     "nii_offered_big",     "nii_shares_bid_for_big",   "nii_bid_amt_big",     "B-NII"},
            {"rii",         "rii_offered",         "rii_shares_bid_for",       "rii_bid_amt",         "RII"},
            {"emp",         "emp_offered",         "emp_shares_bid_for",       "emp_bid_amt",         "Employee"},
            {"shareholder", "shareholder_offered", "shareholder_shares_bid",   "shareholder_bid_amt", "Shareholder"},
            {"other",       "other_offered",       "other_shares_bid_for",     "other_bid_amt",       "Other"},
    };

    // ── List (report) field names ─────────────────────────────────────────────────────────────
    private static final String F_REPORT_DATA = "reportTableData";
    private static final String F_TOTAL_PAGES = "totalPages";
    private static final String F_ID = "~id";
    private static final String F_IPO = "IPO";                            // short company name
    private static final String F_SRT_OPEN = "~Srt_Open";                 // ISO date, e.g. "2026-07-23"
    private static final String F_SRT_BOA = "~Srt_BoA_Dt";                // Basis-of-Allotment ISO date

    // ── GMP-read field names ──────────────────────────────────────────────────────────────────
    private static final String F_GMP_DATA = "ipoGmpData";
    private static final String F_GMP_DATE = "gmp_date";                  // "26-07-2026"
    private static final String F_GMP = "gmp";
    private static final String F_MAX_IPO_PRICE = "max_ipo_price";
    // Extras investorgain publishes alongside the daily GMP. All taken AS REPORTED — they already
    // do the cap+GMP arithmetic for the estimated listing price, so we never recompute it.
    private static final String F_EST_LISTING_PRICE = "estimated_listing_price";
    private static final String F_SUBJECT_TO_SAUDA = "subject_to_sauda";
    private static final String F_EST_PROFIT = "est_profit";
    private static final String F_LAST_UPDATED = "last_updated";           // "27-Aug-2026 20:02"
    private static final String F_GMP_PERCENT = "gmp_percent_calc";        // "<span…>(67.07%)</span>"

    /** The signed percentage inside investorgain's own percent fragment. */
    private static final java.util.regex.Pattern PERCENT =
            java.util.regex.Pattern.compile("\\(\\s*(-?[\\d.]+)\\s*%\\s*\\)");

    private static final DateTimeFormatter GMP_DATE = DateTimeFormatter.ofPattern("dd-MM-yyyy", Locale.ENGLISH);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final IpoHttpClient httpClient;
    private final IpoListingRepository listingRepo;
    private final IpoGmpHistoryRepository gmpHistoryRepo;
    private final IpoSubscriptionHistoryRepository subHistoryRepo;
    private final InvestorgainMatcher matcher;
    private final IpoSourcePollService pollService;
    private final SettingsService settingsService;
    private final Clock clock;

    @Autowired
    public InvestorgainGmpService(IpoHttpClient httpClient, IpoListingRepository listingRepo,
                                  IpoGmpHistoryRepository gmpHistoryRepo, IpoSubscriptionHistoryRepository subHistoryRepo,
                                  InvestorgainMatcher matcher, IpoSourcePollService pollService, SettingsService settingsService) {
        this(httpClient, listingRepo, gmpHistoryRepo, subHistoryRepo, matcher, pollService, settingsService, Clock.systemUTC());
    }

    /** Test-friendly constructor with an injectable clock for a deterministic health timestamp. */
    InvestorgainGmpService(IpoHttpClient httpClient, IpoListingRepository listingRepo,
                           IpoGmpHistoryRepository gmpHistoryRepo, IpoSubscriptionHistoryRepository subHistoryRepo,
                           InvestorgainMatcher matcher, IpoSourcePollService pollService, SettingsService settingsService, Clock clock) {
        this.httpClient = httpClient;
        this.listingRepo = listingRepo;
        this.gmpHistoryRepo = gmpHistoryRepo;
        this.subHistoryRepo = subHistoryRepo;
        this.matcher = matcher;
        this.pollService = pollService;
        this.settingsService = settingsService;
        this.clock = clock;
    }

    /** Configured Investorgain (webnodejs) base URL, falling back to {@link #DEFAULT_BASE_URL} when
     * the {@link ConfigKeys#IPO_INVESTORGAIN_BASE_URL} setting is blank/unset. Trailing "/" trimmed
     * so it joins cleanly with the leading-slash path templates. */
    private String baseUrl() {
        String configured = settingsService.getString(ConfigKeys.IPO_INVESTORGAIN_BASE_URL);
        String base = (configured == null || configured.isBlank()) ? DEFAULT_BASE_URL : configured.trim();
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    /**
     * Matches investorgain's dashboard IPOs to our listings and backfills their GMP. Never throws —
     * records source health (OK/FAILED for {@value #SOURCE}) and returns the number of listings
     * whose GMP was updated.
     */
    @Transactional
    public int refreshGmp() {
        Instant now = clock.instant();
        try {
            List<Matched> candidates = matchTracked(fetchListings());
            warnIfBudgetStarves("GMP", candidates, MAX_GMP_FETCHES);
            int updated = 0;
            int budget = MAX_GMP_FETCHES;
            for (Matched matched : candidates) {
                if (budget <= 0) {
                    break;
                }
                budget--;

                List<GmpPoint> points = fetchGmp(matched.listing().id());
                if (points.isEmpty()) {
                    continue;
                }
                backfillHistory(matched.entity().getId(), points);
                applyLatest(matched.entity(), points);
                updated++;
            }

            pollService.recordSuccess(SOURCE, now);
            log.info("investorgain GMP refresh: matched={} budget={} updated={}",
                    candidates.size(), MAX_GMP_FETCHES, updated);
            return updated;
        } catch (Exception e) {
            log.warn("investorgain GMP refresh failed: {}", e.toString());
            pollService.recordFailure(SOURCE, now, "FAILED");
            return 0;
        }
    }

    /**
     * Matches investorgain's dashboard IPOs to our listings and backfills their day-wise category
     * subscription into {@code ipo_subscription_history} (+ stamps each listing's overall
     * {@code subTotal}). Never throws — a failure is logged and swallowed so the poll is unaffected.
     * Returns the number of listings whose subscription history was refreshed. Investorgain keeps the
     * final numbers after close, so this is the source of truth once NSE drops a closed issue.
     */
    @Transactional
    public int refreshSubscription() {
        try {
            List<Matched> candidates = matchTracked(fetchListings());
            warnIfBudgetStarves("subscription", candidates, MAX_SUB_FETCHES);
            int updated = 0;
            int budget = MAX_SUB_FETCHES;
            for (Matched matched : candidates) {
                Listing listing = matched.listing();
                IpoListingEntity entity = matched.entity();

                // Basis-of-Allotment date is in the report row (no HTTP) — investorgain is the
                // authoritative source (NSE/Chittorgarh don't report it), so stamp it for EVERY
                // matched IPO regardless of the subscription-fetch budget below.
                if (listing.boaDate() != null && !listing.boaDate().equals(entity.getAllotmentDate())) {
                    entity.setAllotmentDate(listing.boaDate());
                    listingRepo.save(entity);
                }

                if (budget <= 0) {
                    continue; // out of subscription-fetch budget — but keep stamping allotment above
                }
                budget--;

                List<SubPoint> points = fetchSubscription(listing.id());
                if (points.isEmpty()) {
                    continue;
                }
                backfillSubHistory(entity.getId(), points);
                applyLatestSub(entity, points);
                updated++;
            }
            log.info("investorgain subscription refresh: matched={} budget={} updated={}",
                    candidates.size(), MAX_SUB_FETCHES, updated);
            return updated;
        } catch (Exception e) {
            log.warn("investorgain subscription refresh failed: {}", e.toString());
            return 0;
        }
    }

    /** One day's subscription reading: the category → multiple map, the fuller per-category
     *  breakdown (offered/bid/amount), and the overall multiple. */
    record SubPoint(Instant capturedAt, Map<String, BigDecimal> categories,
                    List<SubscriptionCategoryDto> detail, BigDecimal total, String bidDateLabel) {}

    private List<SubPoint> fetchSubscription(String investorgainId) {
        try {
            IpoHttpResponse response = httpClient.get(
                    (baseUrl() + SUBSCRIPTION_PATH_TEMPLATE).formatted(investorgainId), jsonHeaders());
            return parseSubscriptionPoints(response.body());
        } catch (Exception e) {
            log.warn("investorgain: subscription fetch failed for id {}: {}", investorgainId, e.toString());
            return List.of();
        }
    }

    /** Extracted for unit testing without HTTP — parses {@code data.ipoBiddingData} into day points. */
    List<SubPoint> parseSubscriptionPoints(String body) {
        List<SubPoint> result = new ArrayList<>();
        try {
            JsonNode array = MAPPER.readTree(body).path(F_SUB_DATA).path(F_SUB_BIDDING);
            if (!array.isArray()) {
                return result;
            }
            for (JsonNode node : array) {
                LocalDate day = parseIsoDate(text(node, F_SUB_CREATE_DATE));
                if (day == null) {
                    day = parseIsoDate(text(node, F_SUB_COR_DATE));
                }
                if (day == null) {
                    continue;
                }
                Map<String, BigDecimal> categories = new LinkedHashMap<>();
                List<SubscriptionCategoryDto> detail = new ArrayList<>();
                for (String[] cat : SUB_CATEGORIES) {
                    String offered = text(node, cat[1]);
                    if (offered == null || offered.isBlank() || "0".equals(offered.trim())) {
                        continue; // this category doesn't exist for this IPO
                    }
                    BigDecimal times = decimal(text(node, cat[0]));
                    if (times == null) {
                        continue;
                    }
                    String label = cat[4];
                    categories.put(label, times);
                    detail.add(new SubscriptionCategoryDto(label, times,
                            indianDecimal(offered), indianDecimal(text(node, cat[2])), indianDecimal(text(node, cat[3]))));
                }
                BigDecimal total = decimal(text(node, F_SUB_TOTAL));
                if (categories.isEmpty() && total == null) {
                    continue;
                }
                result.add(new SubPoint(day.atStartOfDay(ZoneOffset.UTC).toInstant(), categories, detail, total,
                        blankToNull(text(node, F_SUB_BID_DATE))));
            }
        } catch (Exception e) {
            log.warn("investorgain: subscription parse failed: {}", e.toString());
        }
        return result;
    }

    /**
     * UPSERTs each day's subscription into {@code ipo_subscription_history}, keyed by
     * {@code (ipoId, capturedAt)} where {@code capturedAt} is the day at UTC midnight — so re-running
     * updates a changed day in place and never duplicates a day already stored.
     */
    private void backfillSubHistory(String ipoId, List<SubPoint> points) {
        Map<Instant, IpoSubscriptionHistoryEntity> existing = new LinkedHashMap<>();
        for (IpoSubscriptionHistoryEntity row : subHistoryRepo.findByIpoIdOrderByCapturedAtAsc(ipoId)) {
            existing.putIfAbsent(row.getCapturedAt(), row);
        }
        for (SubPoint point : points) {
            String categoriesJson = IpoSubscriptionJson.toJson(point.categories());
            String detailJson = IpoSubscriptionJson.toDetailJson(point.detail());
            IpoSubscriptionHistoryEntity row = existing.get(point.capturedAt());
            if (row == null) {
                subHistoryRepo.save(IpoSubscriptionHistoryEntity.builder()
                        .ipoId(ipoId)
                        .categoriesJson(categoriesJson)
                        .categoryDetailJson(detailJson)
                        .total(point.total())
                        .source(SOURCE)
                        .capturedAt(point.capturedAt())
                        .build());
            } else if (!java.util.Objects.equals(row.getCategoriesJson(), categoriesJson)
                    || !java.util.Objects.equals(row.getCategoryDetailJson(), detailJson)
                    || bigDecimalDiffers(row.getTotal(), point.total())) {
                row.setCategoriesJson(categoriesJson);
                row.setCategoryDetailJson(detailJson);
                row.setTotal(point.total());
                row.setSource(SOURCE);
                subHistoryRepo.save(row);
            }
        }
    }

    /** Stamps the listing's overall {@code subTotal} with the most recent day's total. */
    private void applyLatestSub(IpoListingEntity entity, List<SubPoint> points) {
        SubPoint latest = points.get(0);
        for (SubPoint point : points) {
            if (point.capturedAt().isAfter(latest.capturedAt())) {
                latest = point;
            }
        }
        boolean changed = latest.total() != null && bigDecimalDiffers(entity.getSubTotal(), latest.total());
        if (changed) {
            entity.setSubTotal(latest.total());
        }
        // Their own "as of" wording, stored verbatim so the UI can say exactly how fresh the
        // subscription figures are rather than implying they're live.
        if (latest.bidDateLabel() != null && !latest.bidDateLabel().equals(entity.getSubscriptionUpdatedLabel())) {
            entity.setSubscriptionUpdatedLabel(latest.bidDateLabel());
            changed = true;
        }
        if (changed) {
            listingRepo.save(entity);
        }
    }

    /** An investorgain report row paired with the tracked listing it resolved to. */
    record Matched(Listing listing, IpoListingEntity entity) {}

    /**
     * Resolves the report rows to the listings we actually track, MOST RECENTLY OPENING FIRST.
     *
     * <p>The ordering is what makes the per-refresh fetch budgets ({@link #MAX_GMP_FETCHES} /
     * {@link #MAX_SUB_FETCHES}) land somewhere useful. The report covers the WHOLE financial year,
     * so in a busy season the matched set is several times the budget — spending it in the report's
     * own arbitrary row order meant the 30 calls could go entirely to issues that listed months ago
     * while the currently-open and just-listed ones (the ones on screen) were left with no GMP and
     * no subscription at all. Sorting by open date descending puts upcoming and just-opened issues
     * at the front and long-settled ones last, so the budget always covers what users are looking
     * at; rows with no open date sort last (they're the least identifiable anyway).
     */
    private List<Matched> matchTracked(List<Listing> listings) {
        // Resolution (stored investorgain id → exact squashed name → name prefix) lives in
        // InvestorgainMatcher so the live tier and this day-wise tier can never disagree about which
        // of our IPOs a feed row is about. A name-based hit stamps the id onto the entity, which is
        // saved below, so each IPO is name-matched at most once.
        InvestorgainMatcher.Index index = matcher.loadIndex();
        List<Matched> matched = new ArrayList<>();
        for (Listing listing : listings) {
            IpoListingEntity entity =
                    matcher.resolve(index, listing.numericId(), listing.companyName(), listing.openDate());
            if (entity != null && isWorthFetching(entity)) {
                matched.add(new Matched(listing, entity));
            }
        }
        matched.sort(Comparator.comparing(m -> m.listing().openDate(),
                Comparator.nullsLast(Comparator.reverseOrder())));
        return matched;
    }

    /**
     * Whether an IPO is still current enough to spend a fetch on. This is the fix for the budget
     * starving the IPOs on screen: the report covers a whole financial year, so ~155 tracked IPOs
     * matched against a 30-fetch budget and the ones users were actually looking at got nothing.
     * Filtering to what's still live cuts the candidate set to roughly the budget, so ordering stops
     * being what decides who gets data.
     *
     * <p>"Still current" = not yet listed (upcoming/open/closed — GMP and subscription are both live
     * for those), or listed recently enough to still be visible in the list. Reuses
     * {@code ipo.list.hide-listed-after-days} for the latter, since an IPO the list already hides is
     * one nobody can be looking at; its "never hide" value of 0 falls back to a fixed window so the
     * candidate set can't grow unbounded again.
     */
    private boolean isWorthFetching(IpoListingEntity entity) {
        LocalDate listingDate = entity.getListingDate();
        if (listingDate == null) {
            return true;
        }
        long hideAfterDays = settingsService.getLong(ConfigKeys.IPO_LIST_HIDE_LISTED_AFTER_DAYS);
        long windowDays = hideAfterDays > 0 ? hideAfterDays : DEFAULT_RECENT_LISTING_DAYS;
        return !listingDate.isBefore(LocalDate.now(clock.withZone(IST)).minusDays(windowDays));
    }

    /**
     * Warns when more tracked IPOs matched than the pass can fetch, naming the ones that lose out.
     * They're the tail of the (newest-open-date-first) list, so they're the least topical — but this
     * is still the reason a given IPO can show no GMP or no subscription, and the signal that the
     * budget needs raising.
     */
    private static void warnIfBudgetStarves(String what, List<Matched> candidates, int budget) {
        if (candidates.size() <= budget) {
            return;
        }
        List<String> skipped = candidates.subList(budget, candidates.size()).stream()
                .map(m -> m.listing().companyName())
                .toList();
        log.warn("investorgain {}: {} tracked IPOs matched but the per-pass budget is {} — no {} "
                + "fetched this pass for: {}", what, candidates.size(), budget, what, skipped);
    }

    /** One dashboard row reduced to what we need to match it to a tracked listing + enrich it
     *  ({@code boaDate} = Basis-of-Allotment date; may be null when not announced yet). */
    record Listing(String id, String companyName, LocalDate openDate, LocalDate boaDate) {
        /** The feed's own numeric id, for {@link InvestorgainMatcher}. Null if it isn't numeric. */
        Integer numericId() {
            try {
                return id == null ? null : Integer.valueOf(id.trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
    }

    /** One day's GMP reading. */
    record GmpPoint(LocalDate date, BigDecimal gmp, BigDecimal gmpPct, BigDecimal estimatedListingPrice,
                    BigDecimal subjectToSauda, BigDecimal estProfit, String updatedLabel) {}

    /** Walks the FY report list (bounded by {@link #MAX_PAGES}), accumulating every IPO's id/name/open date. */
    private List<Listing> fetchListings() {
        List<Listing> all = new ArrayList<>();
        try {
            int page = 1;
            while (page <= MAX_PAGES) {
                IpoHttpResponse response = httpClient.get(listUrl(page), jsonHeaders());
                all.addAll(parseListings(response.body()));
                int totalPages = MAPPER.readTree(response.body()).path(F_TOTAL_PAGES).asInt(1);
                if (page >= totalPages) {
                    break;
                }
                page++;
            }
        } catch (Exception e) {
            log.warn("investorgain: list fetch failed: {}", e.toString());
        }
        return all;
    }

    /** The report URL for a given page of the current Indian financial year (computed in IST). */
    String listUrl(int page) {
        ZonedDateTime nowIst = ZonedDateTime.now(clock.withZone(IST));
        int fyStart = nowIst.getMonthValue() >= 4 ? nowIst.getYear() : nowIst.getYear() - 1;
        String fyLabel = fyStart + "-" + String.format(Locale.ROOT, "%02d", (fyStart + 1) % 100);
        return (baseUrl() + LIST_PATH_TEMPLATE).formatted(page, nowIst.getMonthValue(), fyStart, fyLabel);
    }

    /** Extracted for unit testing without HTTP — parses a report-list body into id/name/open-date rows. */
    List<Listing> parseListings(String body) {
        List<Listing> result = new ArrayList<>();
        try {
            JsonNode array = MAPPER.readTree(body).path(F_REPORT_DATA);
            if (!array.isArray()) {
                return result;
            }
            for (JsonNode node : array) {
                String id = text(node, F_ID);
                String company = text(node, F_IPO);
                LocalDate openDate = parseIsoDate(text(node, F_SRT_OPEN));
                LocalDate boaDate = parseIsoDate(text(node, F_SRT_BOA));
                if (id != null && company != null) {
                    result.add(new Listing(id, company, openDate, boaDate));
                }
            }
        } catch (Exception e) {
            log.warn("investorgain: list parse failed: {}", e.toString());
        }
        return result;
    }

    private List<GmpPoint> fetchGmp(String investorgainId) {
        try {
            IpoHttpResponse response = httpClient.get((baseUrl() + GMP_PATH_TEMPLATE).formatted(investorgainId), jsonHeaders());
            return parseGmpPoints(response.body());
        } catch (Exception e) {
            log.warn("investorgain: GMP fetch failed for id {}: {}", investorgainId, e.toString());
            return List.of();
        }
    }

    /** Extracted for unit testing without HTTP. */
    List<GmpPoint> parseGmpPoints(String body) {
        List<GmpPoint> result = new ArrayList<>();
        try {
            JsonNode array = MAPPER.readTree(body).path(F_GMP_DATA);
            if (!array.isArray()) {
                return result;
            }
            for (JsonNode node : array) {
                LocalDate date = parseGmpDate(text(node, F_GMP_DATE));
                BigDecimal gmp = decimal(text(node, F_GMP));
                if (date == null || gmp == null) {
                    continue;
                }
                // Prefer THEIR percentage over ours: they publish gmp_percent_calc (as an HTML
                // fragment, e.g. <span class="pos">(67.07%)</span>), so computePct is only the
                // fallback for a row that doesn't carry it.
                BigDecimal reportedPct = firstPercent(text(node, F_GMP_PERCENT));
                result.add(new GmpPoint(date, gmp,
                        reportedPct != null ? reportedPct : computePct(gmp, decimal(text(node, F_MAX_IPO_PRICE))),
                        decimal(text(node, F_EST_LISTING_PRICE)),
                        decimal(text(node, F_SUBJECT_TO_SAUDA)),
                        decimal(text(node, F_EST_PROFIT)),
                        blankToNull(text(node, F_LAST_UPDATED))));
            }
        } catch (Exception e) {
            log.warn("investorgain: GMP parse failed: {}", e.toString());
        }
        return result;
    }

    /**
     * UPSERTs each day's GMP into {@code ipo_gmp_history}, keyed by {@code (ipoId, capturedAt)} where
     * {@code capturedAt} is the GMP date at UTC midnight — so re-running a refresh updates a changed
     * day in place and never inserts a duplicate for a day already stored.
     */
    private void backfillHistory(String ipoId, List<GmpPoint> points) {
        Map<Instant, IpoGmpHistoryEntity> existing = new LinkedHashMap<>();
        for (IpoGmpHistoryEntity row : gmpHistoryRepo.findByIpoIdOrderByCapturedAtAsc(ipoId)) {
            existing.putIfAbsent(row.getCapturedAt(), row);
        }
        for (GmpPoint point : points) {
            Instant capturedAt = point.date().atStartOfDay(ZoneOffset.UTC).toInstant();
            IpoGmpHistoryEntity row = existing.get(capturedAt);
            if (row == null) {
                gmpHistoryRepo.save(IpoGmpHistoryEntity.builder()
                        .ipoId(ipoId)
                        .gmp(point.gmp())
                        .gmpPct(point.gmpPct())
                        .source(SOURCE)
                        .capturedAt(capturedAt)
                        .build());
            } else if (bigDecimalDiffers(row.getGmp(), point.gmp()) || bigDecimalDiffers(row.getGmpPct(), point.gmpPct())) {
                row.setGmp(point.gmp());
                row.setGmpPct(point.gmpPct());
                row.setSource(SOURCE);
                gmpHistoryRepo.save(row);
            }
        }
    }

    /** Stamps the listing with the most recent day's GMP. */
    private void applyLatest(IpoListingEntity entity, List<GmpPoint> points) {
        GmpPoint latest = points.get(0);
        for (GmpPoint point : points) {
            if (point.date().isAfter(latest.date())) {
                latest = point;
            }
        }
        boolean changed = bigDecimalDiffers(entity.getGmp(), latest.gmp())
                || bigDecimalDiffers(entity.getGmpPct(), latest.gmpPct());
        if (changed) {
            entity.setGmp(latest.gmp());
            entity.setGmpPct(latest.gmpPct());
        }
        // The per-IPO endpoint is the only place these three appear, and its "last updated" label
        // carries a year where the live report's does not — so it refines that too when present.
        changed |= stamp(latest.estimatedListingPrice(), entity.getEstimatedListingPrice(),
                entity::setEstimatedListingPrice);
        changed |= stamp(latest.subjectToSauda(), entity.getSubjectToSauda(), entity::setSubjectToSauda);
        changed |= stamp(latest.estProfit(), entity.getEstProfit(), entity::setEstProfit);
        if (latest.updatedLabel() != null && !latest.updatedLabel().equals(entity.getGmpUpdatedLabel())) {
            entity.setGmpUpdatedLabel(latest.updatedLabel());
            changed = true;
        }
        if (changed) {
            listingRepo.save(entity);
        }
    }

    /** The percentage out of investorgain's own {@code (67.07%)} fragment, or null if absent. */
    private static BigDecimal firstPercent(String raw) {
        if (raw == null) {
            return null;
        }
        java.util.regex.Matcher m = PERCENT.matcher(raw);
        return m.find() ? decimal(m.group(1)) : null;
    }

    private static String blankToNull(String raw) {
        return raw == null || raw.isBlank() ? null : raw.trim();
    }

    /** Writes {@code incoming} when it differs from what's stored; reports whether it did. */
    private static boolean stamp(BigDecimal incoming, BigDecimal current,
                                  java.util.function.Consumer<BigDecimal> setter) {
        if (incoming == null || !bigDecimalDiffers(current, incoming)) {
            return false;
        }
        setter.accept(incoming);
        return true;
    }

    private static Map<String, String> jsonHeaders() {
        return Map.of(
                HttpHeaders.USER_AGENT, USER_AGENT,
                HttpHeaders.ACCEPT, "application/json, text/plain, */*",
                HttpHeaders.REFERER, INVESTORGAIN_ORIGIN + "/",
                HttpHeaders.ORIGIN, INVESTORGAIN_ORIGIN
        );
    }

    /** {@code gmp * 100 / maxPrice}, 2dp; {@code null} if the price is missing or zero. */
    private static BigDecimal computePct(BigDecimal gmp, BigDecimal maxPrice) {
        if (gmp == null || maxPrice == null || maxPrice.signum() == 0) {
            return null;
        }
        return gmp.multiply(BigDecimal.valueOf(100)).divide(maxPrice, 2, RoundingMode.HALF_UP);
    }

    private static LocalDate parseIsoDate(String raw) {
        if (raw == null || raw.length() < 10) {
            return null;
        }
        try {
            return LocalDate.parse(raw.substring(0, 10)); // "2026-07-23T00:00:00.000Z" → 2026-07-23
        } catch (Exception e) {
            return null;
        }
    }

    private static LocalDate parseGmpDate(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(raw.trim(), GMP_DATE);
        } catch (Exception e) {
            return null;
        }
    }

    private static BigDecimal decimal(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(raw.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Parses an Indian-grouped number string (e.g. {@code "1,56,74,494"} or {@code "1,55,437.51"}),
     *  stripping the comma separators; {@code null} for null/blank/unparseable. */
    private static BigDecimal indianDecimal(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(raw.trim().replace(",", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static boolean bigDecimalDiffers(BigDecimal a, BigDecimal b) {
        if (a == null && b == null) {
            return false;
        }
        if (a == null || b == null) {
            return true;
        }
        return a.compareTo(b) != 0;
    }
}
