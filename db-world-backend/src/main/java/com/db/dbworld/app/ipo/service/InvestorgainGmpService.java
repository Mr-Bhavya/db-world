package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.entity.IpoGmpHistoryEntity;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.repository.IpoGmpHistoryRepository;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.app.ipo.source.support.IpoHttpClient;
import com.db.dbworld.app.ipo.source.support.IpoHttpResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.log4j.Log4j2;

import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
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
    private static final String LIST_MAINBOARD = "https://webnodejs.investorgain.com/cloud/v2/ipodashboard/iposubscription-read/IPO";
    private static final String LIST_SME = "https://webnodejs.investorgain.com/cloud/v2/ipodashboard/iposubscription-read/SME";
    private static final String GMP_URL_TEMPLATE = "https://webnodejs.investorgain.com/cloud/v2/ipo/ipo-gmp-read/%s/true";

    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    private static final String INVESTORGAIN_ORIGIN = "https://www.investorgain.com";

    /** Cap on per-IPO GMP fetches per refresh — only spent on IPOs that matched a tracked listing. */
    private static final int MAX_GMP_FETCHES = 30;

    // ── List (dashboard) field names ────────────────────────────────────────────────────────────
    private static final String F_IPO_LIST = "ipoList";
    private static final String F_ID = "id";
    private static final String F_COMPANY_SHORT_NAME = "company_short_name";
    private static final String F_ISSUE_OPEN_DT = "Issue_open_dt";       // ISO, e.g. "2026-07-23T00:00:00.000Z"

    // ── GMP-read field names ──────────────────────────────────────────────────────────────────
    private static final String F_GMP_DATA = "ipoGmpData";
    private static final String F_GMP_DATE = "gmp_date";                  // "26-07-2026"
    private static final String F_GMP = "gmp";
    private static final String F_MAX_IPO_PRICE = "max_ipo_price";

    private static final DateTimeFormatter GMP_DATE = DateTimeFormatter.ofPattern("dd-MM-yyyy", Locale.ENGLISH);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final IpoHttpClient httpClient;
    private final IpoListingRepository listingRepo;
    private final IpoGmpHistoryRepository gmpHistoryRepo;
    private final IpoNormalizer normalizer;
    private final IpoSourcePollService pollService;
    private final Clock clock;

    public InvestorgainGmpService(IpoHttpClient httpClient, IpoListingRepository listingRepo,
                                  IpoGmpHistoryRepository gmpHistoryRepo, IpoNormalizer normalizer,
                                  IpoSourcePollService pollService) {
        this(httpClient, listingRepo, gmpHistoryRepo, normalizer, pollService, Clock.systemUTC());
    }

    /** Test-friendly constructor with an injectable clock for a deterministic health timestamp. */
    InvestorgainGmpService(IpoHttpClient httpClient, IpoListingRepository listingRepo,
                           IpoGmpHistoryRepository gmpHistoryRepo, IpoNormalizer normalizer,
                           IpoSourcePollService pollService, Clock clock) {
        this.httpClient = httpClient;
        this.listingRepo = listingRepo;
        this.gmpHistoryRepo = gmpHistoryRepo;
        this.normalizer = normalizer;
        this.pollService = pollService;
        this.clock = clock;
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
            List<Listing> listings = new ArrayList<>();
            listings.addAll(fetchListings(LIST_MAINBOARD));
            listings.addAll(fetchListings(LIST_SME));

            int updated = 0;
            int budget = MAX_GMP_FETCHES;
            for (Listing listing : listings) {
                String matchKey = normalizer.matchKey(listing.companyName(), listing.openDate());
                if (matchKey == null) {
                    continue;
                }
                IpoListingEntity entity = listingRepo.findByMatchKey(matchKey).orElse(null);
                if (entity == null) {
                    continue; // not an IPO we track — don't spend an HTTP call on it
                }
                if (budget <= 0) {
                    break;
                }
                budget--;

                List<GmpPoint> points = fetchGmp(listing.id());
                if (points.isEmpty()) {
                    continue;
                }
                backfillHistory(entity.getId(), points);
                applyLatest(entity, points);
                updated++;
            }

            pollService.recordSuccess(SOURCE, now);
            log.info("investorgain GMP refresh: updated {} IPO(s)", updated);
            return updated;
        } catch (Exception e) {
            log.warn("investorgain GMP refresh failed: {}", e.toString());
            pollService.recordFailure(SOURCE, now, "FAILED");
            return 0;
        }
    }

    /** One dashboard row reduced to what we need to match it to a tracked listing + fetch its GMP. */
    record Listing(String id, String companyName, LocalDate openDate) {}

    /** One day's GMP reading. */
    record GmpPoint(LocalDate date, BigDecimal gmp, BigDecimal gmpPct) {}

    private List<Listing> fetchListings(String url) {
        try {
            IpoHttpResponse response = httpClient.get(url, jsonHeaders());
            return parseListings(response.body());
        } catch (Exception e) {
            log.warn("investorgain: list fetch failed for {}: {}", url, e.toString());
            return List.of();
        }
    }

    /** Extracted for unit testing without HTTP. */
    List<Listing> parseListings(String body) {
        List<Listing> result = new ArrayList<>();
        try {
            JsonNode array = MAPPER.readTree(body).path(F_IPO_LIST);
            if (!array.isArray()) {
                return result;
            }
            for (JsonNode node : array) {
                String id = text(node, F_ID);
                String company = text(node, F_COMPANY_SHORT_NAME);
                LocalDate openDate = parseIsoDate(text(node, F_ISSUE_OPEN_DT));
                if (id != null && company != null) {
                    result.add(new Listing(id, company, openDate));
                }
            }
        } catch (Exception e) {
            log.warn("investorgain: list parse failed: {}", e.toString());
        }
        return result;
    }

    private List<GmpPoint> fetchGmp(String investorgainId) {
        try {
            IpoHttpResponse response = httpClient.get(GMP_URL_TEMPLATE.formatted(investorgainId), jsonHeaders());
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
                result.add(new GmpPoint(date, gmp, computePct(gmp, decimal(text(node, F_MAX_IPO_PRICE)))));
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
        if (bigDecimalDiffers(entity.getGmp(), latest.gmp()) || bigDecimalDiffers(entity.getGmpPct(), latest.gmpPct())) {
            entity.setGmp(latest.gmp());
            entity.setGmpPct(latest.gmpPct());
            listingRepo.save(entity);
        }
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
