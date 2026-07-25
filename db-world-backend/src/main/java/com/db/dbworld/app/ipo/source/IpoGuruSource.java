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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static com.db.dbworld.app.ipo.source.support.IpoJsonUtil.date;
import static com.db.dbworld.app.ipo.source.support.IpoJsonUtil.decimal;
import static com.db.dbworld.app.ipo.source.support.IpoJsonUtil.integer;
import static com.db.dbworld.app.ipo.source.support.IpoJsonUtil.text;

/**
 * Primary IPO data source: <a href="https://www.ipoguru.in">IPO Guru</a>'s JSON API.
 *
 * <p>We do not yet hold the API key or a captured live sample, so this adapter is built against
 * the DOCUMENTED shape only. Every field name below is a best-effort guess, centralised here so a
 * later verification pass can re-map them in one place once a real response is available.
 */
@Log4j2
@Component
public class IpoGuruSource implements IpoSource {

    private static final String KEY = "ipoguru";
    private static final String DEFAULT_BASE_URL = "https://www.ipoguru.in/api/v1";
    private static final String IPOS_PATH = "/ipos";
    private static final String API_KEY_HEADER = "X-API-KEY";
    private static final String ENV_API_KEY = "IPO_GURU_API_KEY";

    private static final ObjectMapper MAPPER = new ObjectMapper();

    // ── Field-name assumptions — TODO(verify): confirm against a real IPO Guru response ──────
    // Envelope: { "success": bool, "count": N, "data": [ {ipo}, ... ] }
    private static final String F_DATA = "data";
    // Per-IPO object:
    private static final String F_NAME = "name";
    private static final String F_TYPE = "type";                     // "mainboard" | "sme"
    private static final String F_STATUS = "status";                 // upcoming/open/closed/listed
    private static final String F_OPEN_DATE = "open_date";
    private static final String F_CLOSE_DATE = "close_date";
    private static final String F_ALLOTMENT_DATE = "allotment_date";
    private static final String F_LISTING_DATE = "listing_date";
    private static final String F_PRICE_MIN = "price_band_min";
    private static final String F_PRICE_MAX = "price_band_max";
    private static final String F_ISSUE_PRICE = "issue_price";       // fixed-price IPOs report this instead of a band
    private static final String F_LOT_SIZE = "lot_size";
    private static final String F_ISSUE_SIZE = "issue_size";
    private static final String F_LISTING_EXCHANGE = "listing_exchange";
    private static final String F_REGISTRAR = "registrar";
    private static final String F_SUBSCRIPTION = "subscription";     // nested object
    private static final String F_SUB_QIB = "qib";
    private static final String F_SUB_NII = "nii";
    private static final String F_SUB_RETAIL = "retail";
    private static final String F_SUB_TOTAL = "total";
    private static final String F_GMP = "gmp";                       // nested object
    private static final String F_GMP_VALUE = "value";
    private static final String F_GMP_PCT = "pct";

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
            // Covers SourceFetchException (non-2xx / network, incl. HTTP 429 — not retried per
            // the documented contract), a failing settingsService.getString() lookup, and JSON
            // parse failures alike: any expected upstream failure here is logged and swallowed to
            // [] per the IpoSource contract.
            log.warn("IPO Guru fetch failed: {}", e.toString());
            return List.of();
        }
    }

    /** Reads the API key from the environment. Overridable in tests (env vars aren't). */
    String resolveApiKey() {
        return System.getenv(ENV_API_KEY);
    }

    private IpoDto toDto(JsonNode n) {
        JsonNode sub = n.path(F_SUBSCRIPTION);
        JsonNode gmp = n.path(F_GMP);

        BigDecimal priceMin = decimal(n, F_PRICE_MIN);
        BigDecimal priceMax = decimal(n, F_PRICE_MAX);
        if (priceMin == null && priceMax == null) {
            // Fixed-price IPOs report a single issue_price instead of a band.
            BigDecimal issuePrice = decimal(n, F_ISSUE_PRICE);
            priceMin = issuePrice;
            priceMax = issuePrice;
        }

        return new IpoDto(
                KEY,                          // source
                null,                         // matchKey — assigned later by the normaliser
                text(n, F_NAME),               // companyName
                text(n, F_TYPE),                // ipoType
                text(n, F_STATUS),               // status
                date(n, F_OPEN_DATE),             // openDate
                date(n, F_CLOSE_DATE),             // closeDate
                date(n, F_ALLOTMENT_DATE),          // allotmentDate
                date(n, F_LISTING_DATE),             // listingDate
                priceMin,                             // priceMin
                priceMax,                              // priceMax
                integer(n, F_LOT_SIZE),                 // lotSize
                text(n, F_ISSUE_SIZE),                   // issueSize
                text(n, F_LISTING_EXCHANGE),               // listingExchange
                null,                                       // listingPrice — not part of this source's documented shape
                null,                                        // listingGainPct — ditto
                decimal(gmp, F_GMP_VALUE),                     // gmp
                decimal(gmp, F_GMP_PCT),                        // gmpPct
                decimal(sub, F_SUB_QIB),                         // subQib
                decimal(sub, F_SUB_NII),                          // subNii
                decimal(sub, F_SUB_RETAIL),                        // subRetail
                decimal(sub, F_SUB_TOTAL),                          // subTotal
                null,                                                // allotmentStatus — not documented for this source
                text(n, F_REGISTRAR),                                 // registrar
                null,                                                  // registrarUrl — not documented for this source
                null,                                                   // logoUrl — not documented for this source
                null,                                                    // about — not documented for this source
                null, null                                               // refundDate, dematDate — not documented for this source
        );
    }
}
