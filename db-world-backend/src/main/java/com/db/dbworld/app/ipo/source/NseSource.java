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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.db.dbworld.app.ipo.source.support.IpoJsonUtil.date;
import static com.db.dbworld.app.ipo.source.support.IpoJsonUtil.decimal;
import static com.db.dbworld.app.ipo.source.support.IpoJsonUtil.text;

/**
 * Authoritative source for dates/status/listing: the NSE (National Stock Exchange) public site.
 *
 * <p>NSE blocks non-browser clients, so every call needs a two-step "bootstrap" dance: first a
 * GET against a normal NSE page to receive session cookies, then the actual data call(s) replaying
 * those cookies with a realistic User-Agent/Accept/Referer. This is fragile by nature (NSE can
 * change its anti-bot behaviour at any time) — ANY failure at the bootstrap step is treated as
 * non-fatal for the whole source: log a warning and return {@code []}.
 *
 * <p>We cannot fetch a live NSE session from this environment (server-side requests are blocked),
 * so the endpoint URLs and field names below are best-effort, mapped to NSE's community-documented
 * IPO JSON shape — see the {@code TODO(verify)} markers. Only the "all upcoming issues" endpoint is
 * targeted: a live run confirmed {@code all-current-issues?category=ipo} 404s (that path does not
 * exist on NSE) and it was dropped; {@code all-upcoming-issues?category=ipo} is confirmed working
 * (it returns rows).
 */
@Log4j2
@Component
public class NseSource implements IpoSource {

    private static final String KEY = "nse";

    // ── Endpoint assumptions ──────────────────────────────────────────────────────────────────
    private static final String HOME_URL = "https://www.nseindia.com/market-data/all-upcoming-issues-ipo";
    /** Upcoming (not-yet-open) IPOs. Confirmed working against a live NSE session — returns rows. */
    private static final String UPCOMING_URL = "https://www.nseindia.com/api/all-upcoming-issues?category=ipo";
    // NOTE: "all-current-issues?category=ipo" was tried for currently-OPEN issues and confirmed
    // to 404 (path does not exist on NSE) — removed. TODO(verify from browser DevTools Network
    // tab): find the real endpoint for currently-open-for-subscription issues, if NSE exposes
    // one, before adding it back. Do not guess another URL.

    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    private static final String ACCEPT = "application/json, text/plain, */*";

    /** Every IPO in this feed lists on NSE by definition of the endpoint scraped. */
    private static final String LISTING_EXCHANGE = "NSE";

    // ── Field-name assumptions — TODO(verify): confirm against a real response for the endpoint ──
    private static final String F_DATA = "data";              // in case an endpoint wraps the array
    private static final String F_COMPANY_NAME = "companyName";
    private static final String F_SYMBOL = "symbol";
    /** TODO(verify): NSE's series marker (e.g. "EQ" for mainboard, "SME" for the SME platform) — passed raw; ingest canonicalizes recognized aliases. */
    private static final String F_SERIES = "series";
    private static final String F_STATUS = "status";
    private static final String F_OPEN_DATE = "issueStartDate";
    private static final String F_CLOSE_DATE = "issueEndDate";
    private static final String F_LISTING_DATE = "listingDate";
    private static final String F_ISSUE_PRICE = "issuePrice";      // pre-listing fixed/issue price
    private static final String F_LISTING_PRICE = "listingPrice"; // post-listing actual price

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

            return fetchAndMap(UPCOMING_URL, dataHeaders);
        } catch (Exception e) {
            // Anti-bot block, cookie/session failure, or a hard failure while bootstrapping — all
            // non-fatal by design. Never propagate; the scheduler just sees an empty result.
            log.warn("NSE fetch failed (likely anti-bot block or upstream change): {}", e.toString());
            return List.of();
        }
    }

    /**
     * Fetches and maps the data endpoint. Any failure here (anti-bot block, shape change,
     * malformed payload) is logged and yields {@code []} — never propagated to the caller.
     */
    private List<IpoDto> fetchAndMap(String url, Map<String, String> headers) {
        try {
            IpoHttpResponse data = httpClient.get(url, headers);
            JsonNode array = resolveArray(MAPPER.readTree(data.body()));
            if (array == null) {
                log.warn("NSE: unexpected response shape at {}", url);
                return List.of();
            }

            List<IpoDto> result = new ArrayList<>();
            for (JsonNode n : array) {
                result.add(toDto(n));
            }
            return result;
        } catch (Exception e) {
            log.warn("NSE: fetch failed for {}: {}", url, e.toString());
            return List.of();
        }
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

    /** TODO(verify): confirm whether the endpoint returns a bare JSON array or {@code {data:[...]}}. */
    private static JsonNode resolveArray(JsonNode root) {
        if (root.isArray()) {
            return root;
        }
        JsonNode data = root.path(F_DATA);
        return data.isArray() ? data : null;
    }

    private IpoDto toDto(JsonNode n) {
        String companyName = text(n, F_COMPANY_NAME);
        if (companyName == null || companyName.isBlank()) {
            companyName = text(n, F_SYMBOL);
        }

        BigDecimal issuePrice = decimal(n, F_ISSUE_PRICE);

        return new IpoDto(
                KEY,                       // source
                null,                      // matchKey — assigned later by the normaliser
                companyName,               // companyName
                text(n, F_SERIES),          // ipoType — raw NSE series marker; ingest canonicalizes
                text(n, F_STATUS),          // status
                date(n, F_OPEN_DATE),        // openDate
                date(n, F_CLOSE_DATE),        // closeDate
                null,                          // allotmentDate — not this source's strength
                date(n, F_LISTING_DATE),        // listingDate
                issuePrice,                       // priceMin — fixed/issue price, same value both bounds
                issuePrice,                        // priceMax
                null,                                // lotSize — not this source's strength
                null,                                 // issueSize — ditto
                LISTING_EXCHANGE,                       // listingExchange
                decimal(n, F_LISTING_PRICE),             // listingPrice
                null,                                      // listingGainPct — not documented for this endpoint
                null, null,                                 // gmp, gmpPct — not NSE's domain
                null, null,                                   // subscriptionCategories, subTotal — not NSE's domain
                null,                                          // allotmentStatus
                null,                                           // registrar
                null,                                             // registrarUrl
                null,                                              // logoUrl — not this source's strength
                null,                                               // about — ditto
                null, null,                                          // refundDate, dematDate — not this source's strength
                null, null, null,                                    // faceValue, freshIssue, offerForSale — not this source's strength
                null, null, null,                                    // tickerSymbol, strengths, risks — not this source's strength
                null                                                 // financials — not this source's strength
        );
    }
}
