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
 * <p>Chittorgarh's strengths are company name, the open/close/allotment/listing dates and the
 * realised listing gain — that's all this adapter maps; other fields are left to IPO Guru/NSE.
 * We fetch the HTML through the shared {@link IpoHttpClient} (same retry policy as the other
 * sources) and hand the body to Jsoup purely for DOM parsing/selection, not networking.
 *
 * <p>The table-parsing logic is deliberately extracted into {@link #parseTable(Document)} so it
 * can be unit tested against a synthesized HTML fixture without any HTTP involved. Column
 * matching is done by header text (case-insensitive, tolerant of reordering) rather than fixed
 * indices, since Chittorgarh's markup carries no semantic classes/ids per cell.
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
        int idxGain = findColumn(headers, H_GAIN);

        List<IpoDto> result = new ArrayList<>();
        for (Element row : resolveDataRows(table)) {
            Elements cells = row.select("td");
            if (cells.isEmpty()) {
                continue;
            }
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
                    null, null,                                     // priceMin, priceMax — not mapped (YAGNI, other sources cover this)
                    null, null,                                      // lotSize, issueSize
                    null,                                              // listingExchange
                    null,                                              // listingPrice
                    parsePercent(cellText(cells, idxGain)),            // listingGainPct
                    null, null,                                        // gmp, gmpPct
                    null, null, null, null,                            // subQib, subNii, subRetail, subTotal
                    null,                                               // allotmentStatus
                    null, null                                          // registrar, registrarUrl
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
