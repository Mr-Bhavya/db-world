package com.db.dbworld.app.ipo.source;

import com.db.dbworld.app.ipo.dto.IpoDto;
import com.db.dbworld.app.ipo.source.support.IpoHttpClient;
import com.db.dbworld.app.ipo.source.support.IpoHttpResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.log4j.Log4j2;

import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.db.dbworld.app.ipo.source.support.IpoJsonUtil.date;
import static com.db.dbworld.app.ipo.source.support.IpoJsonUtil.decimal;
import static com.db.dbworld.app.ipo.source.support.IpoJsonUtil.text;

/**
 * Authoritative source for dates/status/pricing and live subscription: the NSE (National Stock
 * Exchange) public site.
 *
 * <p>NSE blocks non-browser clients, so every call needs a two-step "bootstrap" dance: first a GET
 * against a normal NSE page to receive session cookies, then the actual data call(s) replaying
 * those cookies with a realistic User-Agent/Accept/Referer. This is fragile by nature (NSE can
 * change its anti-bot behaviour at any time) — ANY failure is non-fatal for the whole source: log
 * a warning and return {@code []}.
 *
 * <p>Three endpoints are used, all confirmed against real responses captured from the browser
 * DevTools Network tab (field names below are taken straight from those samples, not guessed):
 * <ul>
 *   <li>{@code /api/ipo-current-issue} — currently OPEN issues, each with the overall live
 *       subscription multiple ({@code noOfTime}) mapped to {@link IpoDto#subTotal()}.</li>
 *   <li>{@code /api/ipo-detail?symbol=&series=} — per-open-issue enrichment: the QIB/NII/Retail
 *       category subscription ({@code bidDetails}) plus face value / bid lot / registrar / price
 *       range ({@code issueInfo.dataList}). Bounded to the (few) open issues and hard-capped at
 *       {@value #MAX_DETAIL_FETCHES}; any per-issue failure keeps that issue's core data.</li>
 *   <li>{@code /api/all-upcoming-issues?category=ipo} — not-yet-open issues (sparse: mostly name /
 *       symbol / dates).</li>
 * </ul>
 * The two listing endpoints share {@link #mapIssueRow} (both use the same field names); a single
 * IPO never appears in both (open vs upcoming are disjoint).
 */
@Log4j2
@Component
public class NseSource implements IpoSource {

    private static final String KEY = "nse";

    // ── Endpoints ─────────────────────────────────────────────────────────────────────────────
    private static final String HOME_URL = "https://www.nseindia.com/market-data/all-upcoming-issues-ipo";
    /** Currently-OPEN issues (with live subscription {@code noOfTime}). Confirmed against a real response. */
    private static final String CURRENT_URL = "https://www.nseindia.com/api/ipo-current-issue";
    /** Not-yet-open issues. Confirmed working against a live NSE session — returns rows. */
    private static final String UPCOMING_URL = "https://www.nseindia.com/api/all-upcoming-issues?category=ipo";
    /** Per-open-issue detail (category subscription + face value / lot / registrar / price range). */
    private static final String DETAIL_URL_TEMPLATE = "https://www.nseindia.com/api/ipo-detail?symbol=%s&series=%s";

    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    private static final String ACCEPT = "application/json, text/plain, */*";

    /** Every IPO in these feeds lists on NSE by definition of the endpoints scraped. */
    private static final String LISTING_EXCHANGE = "NSE";

    /** Hard cap on per-open-issue detail fetches per {@link #fetchAll()} — open issues are few, but guard anyway. */
    private static final int MAX_DETAIL_FETCHES = 15;

    // ── Listing-row field names (shared by ipo-current-issue and all-upcoming-issues) ────────────
    private static final String F_DATA = "data";              // in case an endpoint wraps the array
    private static final String F_COMPANY_NAME = "companyName";
    private static final String F_SYMBOL = "symbol";
    /** NSE's series marker ("EQ" for mainboard, "SME" for the SME platform) — passed raw; ingest canonicalizes. */
    private static final String F_SERIES = "series";
    private static final String F_STATUS = "status";
    private static final String F_OPEN_DATE = "issueStartDate";
    private static final String F_CLOSE_DATE = "issueEndDate";
    private static final String F_LISTING_DATE = "listingDate";
    private static final String F_ISSUE_PRICE = "issuePrice";      // "Rs.120 to Rs.127" band, or a single value
    private static final String F_LISTING_PRICE = "listingPrice";  // post-listing actual price
    private static final String F_NO_OF_TIME = "noOfTime";         // overall subscription multiple (current issues)

    // ── ipo-detail field names ───────────────────────────────────────────────────────────────
    private static final String F_BID_DETAILS = "bidDetails";
    private static final String F_SR_NO = "srNo";
    private static final String F_ISSUE_INFO = "issueInfo";
    private static final String F_DATA_LIST = "dataList";
    private static final String F_TITLE = "title";
    private static final String F_VALUE = "value";
    // bidDetails top-level category rows are keyed by srNo: "1"=QIB, "2"=NII, "3"=Retail, null=Total.
    // Sub-rows ("1(a)", "2.1", "3(b)", ...) are ignored.

    private static final Pattern NUMBER = Pattern.compile("\\d+(?:\\.\\d+)?");
    private static final Pattern INTEGER = Pattern.compile("\\d+");

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final IpoHttpClient httpClient;

    public NseSource(IpoHttpClient httpClient) {
        this.httpClient = httpClient;
    }

    @Override
    public String key() {
        return KEY;
    }

    @Override
    public List<IpoDto> fetchAll() {
        try {
            IpoHttpResponse home = httpClient.get(HOME_URL, browserHeaders(null));
            String cookie = buildCookieHeader(home.header(HttpHeaders.SET_COOKIE));
            if (cookie == null || cookie.isBlank()) {
                log.warn("NSE: bootstrap request returned no session cookie — aborting");
                return List.of();
            }

            Map<String, String> dataHeaders = browserHeaders(HOME_URL);
            dataHeaders.put(HttpHeaders.COOKIE, cookie);

            List<IpoDto> result = new ArrayList<>();

            // Open issues first (richest data), each optionally enriched from its detail page, so
            // that if the same match key ever collided with an upcoming row the open one wins.
            List<CurrentIssue> openIssues = fetchCurrentIssues(dataHeaders);
            int detailBudget = MAX_DETAIL_FETCHES;
            for (CurrentIssue open : openIssues) {
                IpoDto dto = open.dto();
                if (detailBudget > 0 && notBlank(open.symbol()) && notBlank(open.series())) {
                    dto = enrichFromDetail(dto, open.symbol(), open.series(), dataHeaders);
                    detailBudget--;
                }
                result.add(dto);
            }

            result.addAll(fetchUpcoming(dataHeaders));
            return result;
        } catch (Exception e) {
            // Anti-bot block, cookie/session failure, or a hard failure while bootstrapping — all
            // non-fatal by design. Never propagate; the scheduler just sees an empty result.
            log.warn("NSE fetch failed (likely anti-bot block or upstream change): {}", e.toString());
            return List.of();
        }
    }

    /** Currently-open issues (bare JSON array), each paired with its raw symbol/series for detail enrichment. */
    private List<CurrentIssue> fetchCurrentIssues(Map<String, String> headers) {
        try {
            IpoHttpResponse data = httpClient.get(CURRENT_URL, headers);
            JsonNode array = resolveArray(MAPPER.readTree(data.body()));
            if (array == null) {
                log.warn("NSE: unexpected response shape at {}", CURRENT_URL);
                return List.of();
            }
            List<CurrentIssue> result = new ArrayList<>();
            for (JsonNode n : array) {
                result.add(mapCurrentIssue(n));
            }
            return result;
        } catch (Exception e) {
            log.warn("NSE: current-issue fetch failed: {}", e.toString());
            return List.of();
        }
    }

    /** Upcoming (not-yet-open) issues. Any failure yields {@code []} — never propagated. */
    private List<IpoDto> fetchUpcoming(Map<String, String> headers) {
        try {
            IpoHttpResponse data = httpClient.get(UPCOMING_URL, headers);
            JsonNode array = resolveArray(MAPPER.readTree(data.body()));
            if (array == null) {
                log.warn("NSE: unexpected response shape at {}", UPCOMING_URL);
                return List.of();
            }
            List<IpoDto> result = new ArrayList<>();
            for (JsonNode n : array) {
                result.add(mapIssueRow(n, null));
            }
            return result;
        } catch (Exception e) {
            log.warn("NSE: upcoming fetch failed: {}", e.toString());
            return List.of();
        }
    }

    /** A currently-open issue's dto plus its raw {@code symbol}/{@code series} for the detail-page URL. */
    private record CurrentIssue(IpoDto dto, String symbol, String series) {}

    private CurrentIssue mapCurrentIssue(JsonNode n) {
        BigDecimal subTotal = decimalFromText(text(n, F_NO_OF_TIME));
        IpoDto dto = mapIssueRow(n, subTotal);
        return new CurrentIssue(dto, text(n, F_SYMBOL), text(n, F_SERIES));
    }

    /**
     * Maps one issue row shared by the current-issue and upcoming endpoints (same field names). The
     * NSE series marker becomes the raw {@code ipoType} (ingest canonicalizes "EQ"→mainboard, etc.),
     * the trading symbol becomes {@code tickerSymbol}, and {@code issuePrice} is parsed as a price
     * band. {@code subTotal} is the overall live subscription multiple for a current issue, or
     * {@code null} for an upcoming one.
     */
    private IpoDto mapIssueRow(JsonNode n, BigDecimal subTotal) {
        String companyName = text(n, F_COMPANY_NAME);
        if (companyName == null || companyName.isBlank()) {
            companyName = text(n, F_SYMBOL);
        }
        BigDecimal[] band = parsePriceRange(text(n, F_ISSUE_PRICE));
        return new IpoDto(
                KEY,                          // source
                null,                         // matchKey — assigned later by the normaliser
                companyName,                  // companyName
                text(n, F_SERIES),            // ipoType — raw NSE series marker; ingest canonicalizes
                text(n, F_STATUS),            // status — raw ("Active"/"Listed"); ingest canonicalizes
                date(n, F_OPEN_DATE),         // openDate
                date(n, F_CLOSE_DATE),        // closeDate
                null,                         // allotmentDate — not this source's strength
                date(n, F_LISTING_DATE),      // listingDate
                band[0],                      // priceMin
                band[1],                      // priceMax
                null,                         // lotSize — filled by detail enrichment (open issues)
                null,                         // issueSize — not this source's strength (a share count, not ₹)
                LISTING_EXCHANGE,             // listingExchange
                decimal(n, F_LISTING_PRICE),  // listingPrice
                null,                         // listingGainPct — not documented for these endpoints
                null, null,                   // gmp, gmpPct — not NSE's domain
                null,                         // subscriptionCategories — filled by detail enrichment (open issues)
                subTotal,                     // subTotal — overall live subscription (current issues only)
                null,                         // allotmentStatus
                null,                         // registrar — filled by detail enrichment (open issues)
                null,                         // registrarUrl
                null,                         // logoUrl — not this source's strength
                null,                         // about — ditto
                null, null,                   // refundDate, dematDate
                null,                         // faceValue — filled by detail enrichment (open issues)
                null, null,                   // freshIssue, offerForSale — not this source's strength
                text(n, F_SYMBOL),            // tickerSymbol — NSE trading symbol
                null, null,                   // strengths, risks
                null                          // financials
        );
    }

    /**
     * Enriches one open issue from {@code /api/ipo-detail}: the QIB/NII/Retail category subscription
     * ({@code bidDetails}) and, from {@code issueInfo.dataList}, face value / bid lot / registrar /
     * price range (the price range only fills a gap if the listing row had no band). Any failure
     * (network, anti-bot block, shape change) leaves {@code dto} untouched.
     */
    private IpoDto enrichFromDetail(IpoDto dto, String symbol, String series, Map<String, String> headers) {
        try {
            String url = DETAIL_URL_TEMPLATE.formatted(encode(symbol), encode(series));
            IpoHttpResponse response = httpClient.get(url, headers);
            JsonNode root = MAPPER.readTree(response.body());

            Map<String, BigDecimal> categories = new LinkedHashMap<>();
            BigDecimal total = null;
            for (JsonNode bid : root.path(F_BID_DETAILS)) {
                String srNo = text(bid, F_SR_NO);
                BigDecimal times = decimalFromText(text(bid, F_NO_OF_TIME));
                if (srNo == null || srNo.isBlank()) {
                    if (total == null && times != null) {
                        total = times; // the "Total" row carries a null srNo
                    }
                    continue;
                }
                switch (srNo) {
                    case "1" -> putIfPresent(categories, "QIB", times);
                    case "2" -> putIfPresent(categories, "NII", times);
                    case "3" -> putIfPresent(categories, "Retail", times);
                    default -> { /* sub-rows ("1(a)", "2.1", "3(b)", ...) are ignored */ }
                }
            }

            BigDecimal faceValue = null;
            Integer lotSize = null;
            String registrar = null;
            BigDecimal[] band = null;
            for (JsonNode item : root.path(F_ISSUE_INFO).path(F_DATA_LIST)) {
                String title = text(item, F_TITLE);
                String value = text(item, F_VALUE);
                if (title == null || value == null || value.isBlank()) {
                    continue;
                }
                String t = title.toLowerCase(Locale.ROOT).trim();
                if (t.contains("price range")) {
                    band = parsePriceRange(value);
                } else if (t.equals("face value")) {
                    faceValue = firstDecimal(value);
                } else if (t.equals("bid lot")) {
                    lotSize = firstInteger(value);
                } else if (t.contains("name of the registrar")) {
                    registrar = value.trim();
                }
            }

            Map<String, BigDecimal> mergedCategories = categories.isEmpty() ? dto.subscriptionCategories() : categories;
            BigDecimal mergedSubTotal = total != null ? total : dto.subTotal();
            BigDecimal mergedMin = dto.priceMin() != null ? dto.priceMin() : (band != null ? band[0] : null);
            BigDecimal mergedMax = dto.priceMax() != null ? dto.priceMax() : (band != null ? band[1] : null);

            return withEnrichment(dto, mergedCategories, mergedSubTotal, faceValue, lotSize, registrar, mergedMin, mergedMax);
        } catch (Exception e) {
            log.warn("NSE: detail fetch/parse failed for symbol={} series={}: {}", symbol, series, e.toString());
            return dto;
        }
    }

    private static IpoDto withEnrichment(IpoDto dto, Map<String, BigDecimal> categories, BigDecimal subTotal,
                                         BigDecimal faceValue, Integer lotSize, String registrar,
                                         BigDecimal priceMin, BigDecimal priceMax) {
        return new IpoDto(dto.source(), dto.matchKey(), dto.companyName(), dto.ipoType(), dto.status(),
                dto.openDate(), dto.closeDate(), dto.allotmentDate(), dto.listingDate(),
                priceMin, priceMax, lotSize, dto.issueSize(),
                dto.listingExchange(), dto.listingPrice(), dto.listingGainPct(),
                dto.gmp(), dto.gmpPct(), categories, subTotal,
                dto.allotmentStatus(), registrar, dto.registrarUrl(), dto.logoUrl(), dto.about(),
                dto.refundDate(), dto.dematDate(), faceValue, dto.freshIssue(), dto.offerForSale(),
                dto.tickerSymbol(), dto.strengths(), dto.risks(), dto.financials());
    }

    private static void putIfPresent(Map<String, BigDecimal> map, String category, BigDecimal value) {
        if (value != null) {
            map.put(category, value);
        }
    }

    /**
     * Parses a price expression like {@code "Rs.120 to Rs.127"} / {@code "Rs. 120 to Rs. 127 per
     * Equity Share"} / a single {@code "Rs.90"} into {@code [min, max]} (equal bounds for a single
     * value). Commas are stripped first; only the first two numbers found are used. A blank/zero
     * expression yields {@code [null, null]}.
     */
    private static BigDecimal[] parsePriceRange(String raw) {
        if (raw == null || raw.isBlank()) {
            return new BigDecimal[] {null, null};
        }
        Matcher m = NUMBER.matcher(raw.replace(",", ""));
        List<BigDecimal> numbers = new ArrayList<>(2);
        while (m.find() && numbers.size() < 2) {
            try {
                numbers.add(new BigDecimal(m.group()));
            } catch (NumberFormatException ignored) {
                // skip an unparseable token
            }
        }
        if (numbers.isEmpty()) {
            return new BigDecimal[] {null, null};
        }
        BigDecimal min = numbers.get(0);
        BigDecimal max = numbers.size() >= 2 ? numbers.get(1) : numbers.get(0);
        if (min.signum() == 0 && max.signum() == 0) {
            return new BigDecimal[] {null, null};
        }
        return new BigDecimal[] {min, max};
    }

    /** First decimal number in {@code raw} (e.g. "10" from "Rs.10 per Equity Share"), or {@code null}. */
    private static BigDecimal firstDecimal(String raw) {
        if (raw == null) {
            return null;
        }
        Matcher m = NUMBER.matcher(raw.replace(",", ""));
        if (m.find()) {
            try {
                return new BigDecimal(m.group());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    /** First integer in {@code raw} (e.g. 110 from "Minimum 110 Equity shares"), or {@code null}. */
    private static Integer firstInteger(String raw) {
        if (raw == null) {
            return null;
        }
        Matcher m = INTEGER.matcher(raw.replace(",", ""));
        if (m.find()) {
            try {
                return Integer.valueOf(m.group());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    /** {@link BigDecimal} from a raw string (NSE reports subscription multiples as plain decimals), or {@code null}. */
    private static BigDecimal decimalFromText(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(raw.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static Map<String, String> browserHeaders(String referer) {
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put(HttpHeaders.USER_AGENT, USER_AGENT);
        headers.put(HttpHeaders.ACCEPT, ACCEPT);
        if (referer != null) {
            headers.put(HttpHeaders.REFERER, referer);
        }
        return headers;
    }

    /** Extracts the {@code name=value} pair from each Set-Cookie header and joins them for reuse. */
    private static String buildCookieHeader(List<String> setCookieHeaders) {
        if (setCookieHeaders == null || setCookieHeaders.isEmpty()) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        for (String setCookie : setCookieHeaders) {
            String pair = firstCookiePair(setCookie);
            if (pair == null) {
                continue;
            }
            if (!sb.isEmpty()) {
                sb.append("; ");
            }
            sb.append(pair);
        }
        return sb.isEmpty() ? null : sb.toString();
    }

    private static String firstCookiePair(String setCookie) {
        if (setCookie == null || setCookie.isBlank()) {
            return null;
        }
        int idx = setCookie.indexOf(';');
        String pair = (idx >= 0 ? setCookie.substring(0, idx) : setCookie).trim();
        return pair.isEmpty() ? null : pair;
    }

    /** Handles either a bare JSON array or a {@code {data:[...]}} envelope. */
    private static JsonNode resolveArray(JsonNode root) {
        if (root.isArray()) {
            return root;
        }
        JsonNode data = root.path(F_DATA);
        return data.isArray() ? data : null;
    }
}
