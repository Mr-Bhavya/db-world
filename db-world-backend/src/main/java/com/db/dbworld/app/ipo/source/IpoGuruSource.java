package com.db.dbworld.app.ipo.source;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.ipo.dto.IpoDto;
import com.db.dbworld.app.ipo.source.support.IpoHttpClient;
import com.db.dbworld.app.ipo.source.support.IpoHttpResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.log4j.Log4j2;

import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static com.db.dbworld.app.ipo.source.support.IpoJsonUtil.date;
import static com.db.dbworld.app.ipo.source.support.IpoJsonUtil.decimal;
import static com.db.dbworld.app.ipo.source.support.IpoJsonUtil.integer;
import static com.db.dbworld.app.ipo.source.support.IpoJsonUtil.text;

/**
 * Primary IPO data source: <a href="https://www.ipoguru.in">IPO Guru</a>'s JSON API.
 *
 * <p>Mapped against the now-fully-documented IPO Guru schema (high confidence — every field name
 * below is taken straight from the docs, not guessed). Base {@code https://www.ipoguru.in/api/v1},
 * {@code GET /ipos}, header {@code X-API-KEY} (key sourced from env {@value #ENV_API_KEY}),
 * rate-limited to 15/min + 300/day; a 429 response carries {@code {message, retry_after}} or
 * {@code {message, resets_at}} and is treated as a plain failure (no retry-with-backoff — see
 * {@link com.db.dbworld.app.ipo.source.support.IpoWebClientConfig}'s javadoc for why).
 */
@Log4j2
@Component
public class IpoGuruSource implements IpoSource {

    private static final String KEY = "ipoguru";
    private static final String DEFAULT_BASE_URL = "https://www.ipoguru.in/api/v1";
    private static final String IPOS_PATH = "/ipos";
    private static final String API_KEY_HEADER = "X-API-KEY";
    private static final String ENV_API_KEY = "IPO_GURU_API_KEY";
    private static final int HTTP_TOO_MANY_REQUESTS = 429;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    // ── Documented field names — envelope: { "success": bool, "count": N, "data": [ {ipo}, ... ] } ──
    private static final String F_DATA = "data";

    // Per-IPO object (documented):
    private static final String F_NAME = "name";
    private static final String F_TYPE = "type";                     // "Mainboard" | "SME"
    private static final String F_STATUS = "status";                 // "Open" | "Upcoming" | "Closed" | ...
    private static final String F_OPEN_DATE = "open_date";
    private static final String F_CLOSE_DATE = "close_date";
    private static final String F_ALLOTMENT_DATE = "allotment_date";
    private static final String F_LISTING_DATE = "listing_date";
    private static final String F_LISTING_PRICE = "listing_price";
    private static final String F_PRICE_BAND = "price_band";          // e.g. "163-172"
    private static final String F_ISSUE_PRICE = "issue_price";        // fallback when there's no band
    private static final String F_FACE_VALUE = "face_value";
    private static final String F_LOT_SIZE = "lot_size";
    private static final String F_ISSUE_SIZE = "issue_size";
    private static final String F_LISTING_ON = "listing_on";          // e.g. "NSE", "BSE", "NSE, BSE"
    private static final String F_REGISTRAR = "registrar";
    private static final String F_SUBSCRIPTION = "subscription";      // nested object
    private static final String F_SUB_QIB = "qib";
    private static final String F_SUB_NII = "nii";
    private static final String F_SUB_RETAIL = "retail";
    private static final String F_SUB_TOTAL = "total";
    private static final String F_GMP = "gmp";                        // nested object
    private static final String F_GMP_PRICE = "price";
    private static final String F_GMP_PCT = "percentage";

    // 429 error body: { "message": "...", "retry_after": N }  or  { "message": "...", "resets_at": "..." }
    private static final String F_ERR_MESSAGE = "message";
    private static final String F_ERR_RETRY_AFTER = "retry_after";
    private static final String F_ERR_RESETS_AT = "resets_at";

    private final SettingsService settingsService;
    private final IpoHttpClient httpClient;

    public IpoGuruSource(SettingsService settingsService, IpoHttpClient httpClient) {
        this.settingsService = settingsService;
        this.httpClient = httpClient;
    }

    @Override
    public String key() {
        return KEY;
    }

    @Override
    public List<IpoDto> fetchAll() {
        String apiKey = resolveApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("IPO Guru: {} is not set — skipping fetch", ENV_API_KEY);
            return List.of();
        }

        try {
            String baseUrl = settingsService.getString(ConfigKeys.IPO_IPOGURU_BASE_URL);
            if (baseUrl == null || baseUrl.isBlank()) {
                baseUrl = DEFAULT_BASE_URL;
            }

            IpoHttpResponse response = httpClient.get(baseUrl + IPOS_PATH, Map.of(API_KEY_HEADER, apiKey));
            JsonNode root = MAPPER.readTree(response.body());
            JsonNode data = root.path(F_DATA);
            if (!data.isArray()) {
                log.warn("IPO Guru: unexpected response shape — no '{}' array", F_DATA);
                return List.of();
            }

            List<IpoDto> result = new ArrayList<>();
            for (JsonNode node : data) {
                result.add(toDto(node));
            }
            return result;
        } catch (Exception e) {
            // Covers SourceFetchException (non-2xx / network, incl. HTTP 429 handled specially
            // below), a failing settingsService.getString() lookup, and JSON parse failures alike:
            // any expected upstream failure here is logged and swallowed to [] per the IpoSource
            // contract — never retried, per the documented "plain failure" 429 contract.
            logFetchFailure(e);
            return List.of();
        }
    }

    /** Reads the API key from the environment. Overridable in tests (env vars aren't). */
    String resolveApiKey() {
        return System.getenv(ENV_API_KEY);
    }

    /** Logs a 429 distinctly (message/retry_after/resets_at from the documented error body) — a plain WARN otherwise. */
    private void logFetchFailure(Exception e) {
        WebClientResponseException rateLimited = findRateLimited(e);
        if (rateLimited == null) {
            log.warn("IPO Guru fetch failed: {}", e.toString());
            return;
        }
        try {
            JsonNode errorBody = MAPPER.readTree(rateLimited.getResponseBodyAsString());
            String message = text(errorBody, F_ERR_MESSAGE);
            String retryAfter = text(errorBody, F_ERR_RETRY_AFTER);
            String resetsAt = text(errorBody, F_ERR_RESETS_AT);
            log.warn("IPO Guru rate limited (429): message={} retry_after={} resets_at={}", message, retryAfter, resetsAt);
        } catch (Exception parseFailure) {
            log.warn("IPO Guru rate limited (429), unparsable body: {}", rateLimited.getMessage());
        }
    }

    /** Walks the cause chain for a 429 {@link WebClientResponseException} (may be wrapped in {@code SourceFetchException}). */
    private static WebClientResponseException findRateLimited(Throwable t) {
        Throwable cause = t;
        while (cause != null) {
            if (cause instanceof WebClientResponseException w && w.getStatusCode().value() == HTTP_TOO_MANY_REQUESTS) {
                return w;
            }
            cause = cause.getCause();
        }
        return null;
    }

    private IpoDto toDto(JsonNode n) {
        JsonNode subscription = n.path(F_SUBSCRIPTION);
        JsonNode gmp = n.path(F_GMP);
        PriceBand band = parsePriceBand(n);

        return new IpoDto(
                KEY,                                     // source
                null,                                     // matchKey — assigned later by the normaliser
                text(n, F_NAME),                          // companyName
                text(n, F_TYPE),                          // ipoType — raw ("Mainboard"/"SME"); ingest canonicalizes
                text(n, F_STATUS),                        // status — raw ("Open"/"Upcoming"/"Closed"); ingest canonicalizes
                date(n, F_OPEN_DATE),                     // openDate
                date(n, F_CLOSE_DATE),                    // closeDate
                date(n, F_ALLOTMENT_DATE),                // allotmentDate
                date(n, F_LISTING_DATE),                  // listingDate
                band.min(),                               // priceMin
                band.max(),                                // priceMax
                integer(n, F_LOT_SIZE),                    // lotSize
                text(n, F_ISSUE_SIZE),                     // issueSize — kept verbatim, e.g. "₹74 Cr"
                normalizeListingExchange(n),                // listingExchange — BOTH/NSE/BSE/null
                decimal(n, F_LISTING_PRICE),                 // listingPrice
                null,                                          // listingGainPct — not documented for this source
                decimal(gmp, F_GMP_PRICE),                       // gmp
                decimal(gmp, F_GMP_PCT),                          // gmpPct — docs: "0 when unavailable", mapped as-is
                parseSubscriptionCategories(subscription),         // subscriptionCategories — ordered QIB/NII/Retail
                decimal(subscription, F_SUB_TOTAL),                 // subTotal
                null,                                                 // allotmentStatus — not documented for this source
                text(n, F_REGISTRAR),                                  // registrar
                null,                                                    // registrarUrl — API gives no URL
                null,                                                     // logoUrl — not documented for this source
                null,                                                      // about — not documented for this source
                null, null,                                                // refundDate, dematDate — not documented
                decimal(n, F_FACE_VALUE), null, null,                       // faceValue; freshIssue/offerForSale — not documented
                null, null, null,                                          // tickerSymbol, strengths, risks — not documented
                null                                                       // financials — not documented for this source
        );
    }

    /** {@code price_band} split into (min, max); falls back to a single {@code issue_price} for max only. */
    private record PriceBand(BigDecimal min, BigDecimal max) {}

    private static PriceBand parsePriceBand(JsonNode n) {
        String raw = text(n, F_PRICE_BAND);
        if (raw != null && !raw.isBlank()) {
            String[] parts = raw.trim().split("[-–]"); // hyphen or en dash
            if (parts.length == 2) {
                BigDecimal min = toDecimal(parts[0]);
                BigDecimal max = toDecimal(parts[1]);
                if (min != null && max != null) {
                    return new PriceBand(min, max);
                }
            } else if (parts.length == 1) {
                BigDecimal single = toDecimal(parts[0]);
                if (single != null) {
                    return new PriceBand(single, single);
                }
            }
        }
        // price_band missing/blank/unparseable — a fixed-price IPO reports issue_price instead.
        return new PriceBand(null, decimal(n, F_ISSUE_PRICE));
    }

    private static BigDecimal toDecimal(String raw) {
        if (raw == null) {
            return null;
        }
        try {
            return new BigDecimal(raw.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** {@code listing_on} → {@code BOTH} (mentions both NSE & BSE), {@code NSE}, {@code BSE}, or {@code null}. */
    private static String normalizeListingExchange(JsonNode n) {
        String raw = text(n, F_LISTING_ON);
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String upper = raw.toUpperCase(Locale.ROOT);
        boolean hasNse = upper.contains("NSE");
        boolean hasBse = upper.contains("BSE");
        if (hasNse && hasBse) {
            return "BOTH";
        }
        if (hasNse) {
            return "NSE";
        }
        if (hasBse) {
            return "BSE";
        }
        return null;
    }

    /** Ordered QIB/NII/Retail map from the {@code subscription} object; a category with a null/blank value is skipped. */
    private static Map<String, BigDecimal> parseSubscriptionCategories(JsonNode subscription) {
        if (subscription == null || subscription.isMissingNode()) {
            return null;
        }
        Map<String, BigDecimal> categories = new LinkedHashMap<>();
        putIfPresent(categories, "QIB", decimal(subscription, F_SUB_QIB));
        putIfPresent(categories, "NII", decimal(subscription, F_SUB_NII));
        putIfPresent(categories, "Retail", decimal(subscription, F_SUB_RETAIL));
        return categories.isEmpty() ? null : categories;
    }

    private static void putIfPresent(Map<String, BigDecimal> map, String category, BigDecimal value) {
        if (value != null) {
            map.put(category, value);
        }
    }
}
