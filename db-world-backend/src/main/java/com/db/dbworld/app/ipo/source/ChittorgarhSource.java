package com.db.dbworld.app.ipo.source;

import com.db.dbworld.app.ipo.dto.IpoDto;
import com.db.dbworld.app.ipo.source.support.IpoDateParser;
import com.db.dbworld.app.ipo.source.support.IpoHttpClient;
import com.db.dbworld.app.ipo.source.support.IpoHttpResponse;
import lombok.extern.log4j.Log4j2;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Fallback / gap-fill source: scrapes Chittorgarh's mainboard IPO list page with Jsoup.
 *
 * <p>We cannot fetch a live Chittorgarh page from this environment (server-side requests are
 * blocked), so this adapter maps to the best-known public structure of the mainboard list table —
 * company name, open/close/allotment/listing dates, price band, lot size, issue size and the
 * realised listing gain — see the {@code TODO(verify)} markers on the page URL and header aliases.
 * We fetch the HTML through the shared {@link IpoHttpClient} (same retry policy as the other
 * sources) and hand the body to Jsoup purely for DOM parsing/selection, not networking.
 *
 * <p>The table-parsing logic is deliberately extracted into {@link #parseTable(Document)} so it
 * can be unit tested against a synthesized HTML fixture without any HTTP involved. Column
 * matching is done by header text (case-insensitive, tolerant of reordering) rather than fixed
 * indices or generated CSS classes/ids — Chittorgarh's markup carries no stable semantic
 * classes/ids per cell, so header-text matching is the least brittle option available.
 */
@Log4j2
@Component
public class ChittorgarhSource implements IpoSource {

    private static final String KEY = "chittorgarh";

    // ── Page assumption — TODO(verify): confirm this URL still serves the mainboard table ────
    private static final String LIST_URL = "https://www.chittorgarh.com/report/mainboard-ipo-list-in-india-bse-nse/83/";

    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    /** This adapter only ever scrapes the mainboard list page, so every row is a mainboard IPO. */
    private static final String IPO_TYPE = "mainboard";

    // ── Column header aliases — TODO(verify): confirm exact header text on the live page ─────
    private static final List<String> H_NAME = List.of("ipo name", "ipo", "company");
    private static final List<String> H_OPEN = List.of("open date", "open");
    private static final List<String> H_CLOSE = List.of("close date", "close");
    private static final List<String> H_ALLOTMENT = List.of("allotment date", "allotment");
    private static final List<String> H_LISTING = List.of("listing date", "est listing", "listing");
    private static final List<String> H_PRICE_BAND = List.of("price band", "issue price", "price");
    // NOTE: no bare "lot" alias — it's a substring of "allotment (date)" and would mismatch that column.
    private static final List<String> H_LOT_SIZE = List.of("lot size");
    private static final List<String> H_ISSUE_SIZE = List.of("issue size");
    private static final List<String> H_GAIN = List.of("listing gain", "gain");

    private final IpoHttpClient httpClient;

    public ChittorgarhSource(IpoHttpClient httpClient) {
        this.httpClient = httpClient;
    }

    @Override
    public String key() {
        return KEY;
    }

    @Override
    public List<IpoDto> fetchAll() {
        try {
            IpoHttpResponse response = httpClient.get(LIST_URL, Map.of(
                    HttpHeaders.USER_AGENT, USER_AGENT,
                    HttpHeaders.ACCEPT, "text/html"
            ));
            Document doc = Jsoup.parse(response.body(), LIST_URL);
            return parseTable(doc);
        } catch (Exception e) {
            log.warn("Chittorgarh fetch failed: {}", e.toString());
            return List.of();
        }
    }

    /** Extracted for unit testing without HTTP — parses a page already fetched into a Document. */
    List<IpoDto> parseTable(Document doc) {
        Element table = doc.selectFirst("table");
        if (table == null) {
            log.warn("Chittorgarh: no <table> found on the page");
            return List.of();
        }

        List<String> headers = resolveHeaders(table);
        int idxName = findColumn(headers, H_NAME);
        int idxOpen = findColumn(headers, H_OPEN);
        int idxClose = findColumn(headers, H_CLOSE);
        int idxAllotment = findColumn(headers, H_ALLOTMENT);
        int idxListing = findColumn(headers, H_LISTING);
        int idxPriceBand = findColumn(headers, H_PRICE_BAND);
        int idxLotSize = findColumn(headers, H_LOT_SIZE);
        int idxIssueSize = findColumn(headers, H_ISSUE_SIZE);
        int idxGain = findColumn(headers, H_GAIN);

        List<IpoDto> result = new ArrayList<>();
        for (Element row : resolveDataRows(table)) {
            Elements cells = row.select("td");
            if (cells.isEmpty()) {
                continue;
            }
            BigDecimal[] priceBand = parsePriceBand(cellText(cells, idxPriceBand));
            result.add(new IpoDto(
                    KEY,                                  // source
                    null,                                 // matchKey — assigned later by the normaliser
                    cellText(cells, idxName),               // companyName
                    IPO_TYPE,                                // ipoType — this page is mainboard-only
                    null,                                     // status — not derivable from this table
                    parseDate(cellText(cells, idxOpen)),        // openDate
                    parseDate(cellText(cells, idxClose)),        // closeDate
                    parseDate(cellText(cells, idxAllotment)),     // allotmentDate
                    parseDate(cellText(cells, idxListing)),        // listingDate
                    priceBand[0],                                   // priceMin
                    priceBand[1],                                    // priceMax
                    parseLotSize(cellText(cells, idxLotSize)),        // lotSize
                    cellText(cells, idxIssueSize),                     // issueSize — kept verbatim
                    null,                                               // listingExchange — not derivable from this table
                    null,                                               // listingPrice
                    parsePercent(cellText(cells, idxGain)),            // listingGainPct
                    null, null,                                        // gmp, gmpPct
                    null, null,                                        // subscriptionCategories, subTotal
                    null,                                               // allotmentStatus
                    null, null,                                         // registrar, registrarUrl
                    null, null,                                         // logoUrl, about — not on this page
                    null, null,                                         // refundDate, dematDate — not on this page
                    null, null, null,                                   // faceValue, freshIssue, offerForSale — not on this page
                    null, null, null                                    // tickerSymbol, strengths, risks — not on this page
            ));
        }
        return result;
    }

    private static List<String> resolveHeaders(Element table) {
        Elements headerCells = table.select("thead th");
        if (!headerCells.isEmpty()) {
            return headerCells.eachText();
        }
        Element firstRow = table.selectFirst("tr");
        return firstRow != null ? firstRow.select("th,td").eachText() : List.of();
    }

    private static Elements resolveDataRows(Element table) {
        Elements bodyRows = table.select("tbody tr");
        if (!bodyRows.isEmpty()) {
            return bodyRows;
        }
        // No <thead>/<tbody> split — assume the first row is the header and skip it.
        Elements allRows = table.select("tr");
        return allRows.isEmpty() ? allRows : new Elements(allRows.subList(1, allRows.size()));
    }

    private static int findColumn(List<String> headers, List<String> aliases) {
        for (int i = 0; i < headers.size(); i++) {
            String header = headers.get(i).toLowerCase(Locale.ROOT).trim();
            for (String alias : aliases) {
                if (header.contains(alias)) {
                    return i;
                }
            }
        }
        return -1;
    }

    private static String cellText(Elements cells, int index) {
        if (index < 0 || index >= cells.size()) {
            return null;
        }
        String text = cells.get(index).text();
        return text == null || text.isBlank() ? null : text.trim();
    }

    private static LocalDate parseDate(String raw) {
        return IpoDateParser.parse(raw);
    }

    /**
     * Splits a "163-172"-style price-band cell into {@code [min, max]}; a single value (no
     * separator) yields equal bounds; blank/unparseable yields {@code [null, null]}.
     */
    private static BigDecimal[] parsePriceBand(String raw) {
        if (raw == null || raw.isBlank()) {
            return new BigDecimal[] {null, null};
        }
        String[] parts = raw.trim().split("[-–]");
        if (parts.length == 2) {
            BigDecimal min = toDecimal(parts[0]);
            BigDecimal max = toDecimal(parts[1]);
            if (min != null && max != null) {
                return new BigDecimal[] {min, max};
            }
        } else if (parts.length == 1) {
            BigDecimal single = toDecimal(parts[0]);
            if (single != null) {
                return new BigDecimal[] {single, single};
            }
        }
        return new BigDecimal[] {null, null};
    }

    private static BigDecimal toDecimal(String raw) {
        if (raw == null) {
            return null;
        }
        // Strips currency symbols/commas (e.g. "₹163") that can appear in a scraped price cell.
        String cleaned = raw.replaceAll("[^0-9.]", "").trim();
        if (cleaned.isEmpty()) {
            return null;
        }
        try {
            return new BigDecimal(cleaned);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Strips non-digit characters (e.g. a "800 Shares" cell) and parses the remainder; null-safe. */
    private static Integer parseLotSize(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String digitsOnly = raw.replaceAll("[^0-9]", "");
        if (digitsOnly.isEmpty()) {
            return null;
        }
        try {
            return Integer.valueOf(digitsOnly);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Strips a trailing "%" (and stray whitespace/dashes) and parses the remainder; null-safe. */
    private static BigDecimal parsePercent(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String cleaned = raw.replace("%", "").trim();
        try {
            return new BigDecimal(cleaned);
        } catch (NumberFormatException e) {
            return null; // e.g. an em-dash placeholder for "not yet listed"
        }
    }
}
