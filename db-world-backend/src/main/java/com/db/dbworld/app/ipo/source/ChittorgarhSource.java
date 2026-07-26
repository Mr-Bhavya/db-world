package com.db.dbworld.app.ipo.source;

import com.db.dbworld.app.ipo.dto.IpoDto;
import com.db.dbworld.app.ipo.dto.IpoFinancialRowDto;
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
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Fallback / gap-fill source: scrapes Chittorgarh's mainboard IPO list page with Jsoup, then
 * (best-effort) each listed IPO's own detail page for its About/Strengths/Risks/Financials.
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
 *
 * <p><b>Detail-page enrichment</b>: each list row's company-name cell is assumed to carry an
 * anchor linking to that IPO's own Chittorgarh detail page ({@code TODO(verify)} — confirmed only
 * against a synthetic fixture, never a live page). That detail-page URL is resolved from the SAME
 * row element used to build the row's {@link IpoDto} — see {@code parseRows(Document)} — so an
 * empty/spacer row (e.g. an ad or divider row with no {@code <td>} cells) is skipped identically
 * for both and can never desynchronise a dto from a different row's detail URL. {@link
 * #fetchAll()} then fetches the detail page (one extra HTTP round-trip per IPO — acceptable given
 * the mainboard list is only ever ~10-20 active IPOs and this whole adapter runs on a periodic
 * poll, not per-request), and parses the About paragraph(s), Strengths/Risks bullet lists, and the
 * "Company Financials" table via {@link #parseDetail(Document)} (unit-testable the same way as
 * {@link #parseTable}). Every step is best-effort: a missing section yields {@code null}/empty for
 * just that field, and ANY failure fetching/parsing one IPO's detail page (network, anti-bot
 * block, shape change) leaves that IPO's core list-row data untouched and never propagates out of
 * {@link #fetchAll()}.
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
    // NOTE: no bare "listing" alias — it's a substring of "listing price"/"listing gain" and would mismatch those columns.
    private static final List<String> H_LISTING = List.of("listing date", "est listing");
    // NOTE: no bare "price" alias — it's a substring of "listing price" and would mismatch that column.
    private static final List<String> H_PRICE_BAND = List.of("price band", "price range", "issue price", "price (rs)");
    // NOTE: no bare "lot" alias — it's a substring of "allotment (date)" and would mismatch that column.
    private static final List<String> H_LOT_SIZE = List.of("lot size");
    private static final List<String> H_ISSUE_SIZE = List.of("issue size");
    private static final List<String> H_GAIN = List.of("listing gain", "gain");

    // ── Detail-page "Company Financials" column aliases — TODO(verify) against a live page ───
    private static final List<String> H_FIN_PERIOD = List.of("period", "year", "fy");
    private static final List<String> H_FIN_REVENUE = List.of("revenue", "total income");
    private static final List<String> H_FIN_PAT = List.of("profit after tax", "pat", "net profit");
    private static final List<String> H_FIN_ASSETS = List.of("total assets", "net worth");

    // ── Detail-page section headings — matched by text, not markup, since Chittorgarh's detail
    // pages carry no stable semantic classes/ids either — TODO(verify) against a live page ─────
    private static final Pattern ABOUT_HEADING = Pattern.compile("^about\\b.*", Pattern.CASE_INSENSITIVE);
    private static final Pattern STRENGTHS_HEADING = Pattern.compile(".*strengths?.*", Pattern.CASE_INSENSITIVE);
    private static final Pattern RISKS_HEADING = Pattern.compile(".*(risks?|weakness(es)?).*", Pattern.CASE_INSENSITIVE);
    private static final Pattern FINANCIALS_HEADING = Pattern.compile(".*financials?.*", Pattern.CASE_INSENSITIVE);
    private static final String HEADING_SELECTOR = "h1,h2,h3,h4,h5,strong,b";
    /** Bails out of the heading→content sibling walk after this many hops so a shape mismatch can't loop indefinitely. */
    private static final int MAX_SIBLING_HOPS = 6;

    private static final Pattern FY_RANGE = Pattern.compile("FY\\s*-?\\s*(\\d{2,4})\\s*[-/]\\s*(\\d{2,4})", Pattern.CASE_INSENSITIVE);
    private static final Pattern FY_SINGLE = Pattern.compile("FY\\s*-?\\s*(\\d{2,4})\\b", Pattern.CASE_INSENSITIVE);
    private static final DateTimeFormatter MONTH_YEAR_SHORT = DateTimeFormatter.ofPattern("MMM yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter MONTH_YEAR_FULL = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.ENGLISH);

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
            List<RowWithDetailUrl> rows = parseRows(doc);

            List<IpoDto> result = new ArrayList<>(rows.size());
            for (RowWithDetailUrl row : rows) {
                result.add(enrichFromDetailPage(row.dto(), row.detailUrl()));
            }
            return result;
        } catch (Exception e) {
            log.warn("Chittorgarh fetch failed: {}", e.toString());
            return List.of();
        }
    }

    /**
     * One data row's parsed {@link IpoDto} paired, in the SAME pass, with that same row's
     * detail-page URL — so an empty/spacer row (no {@code <td>} cells, e.g. an ad or divider row)
     * is skipped identically for both, and a dto can never end up zipped against a different row's
     * detail URL (see {@link #parseRows(Document)}).
     */
    private record RowWithDetailUrl(IpoDto dto, String detailUrl) {}

    /** Extracted for unit testing without HTTP — parses a page already fetched into a Document. */
    List<IpoDto> parseTable(Document doc) {
        List<RowWithDetailUrl> rows = parseRows(doc);
        List<IpoDto> result = new ArrayList<>(rows.size());
        for (RowWithDetailUrl row : rows) {
            result.add(row.dto());
        }
        return result;
    }

    /**
     * Parses the mainboard list table into one {@link RowWithDetailUrl} per data row, in a single
     * pass. Building the dto and resolving its detail-page URL from the SAME {@code row} element —
     * rather than in two separate passes zipped together by index afterwards — means the empty-row
     * skip ({@code if (cells.isEmpty()) continue;}) applies identically to both: there is no way for
     * a spacer/ad row to desynchronise a dto from a different row's detail URL, which is exactly
     * what happened when {@code parseTable} and a separate {@code resolveDetailUrls} pass (each with
     * their own row-skipping rules) were zipped together by index.
     */
    private List<RowWithDetailUrl> parseRows(Document doc) {
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

        List<RowWithDetailUrl> result = new ArrayList<>();
        for (Element row : resolveDataRows(table)) {
            Elements cells = row.select("td");
            if (cells.isEmpty()) {
                continue;
            }
            BigDecimal[] priceBand = parsePriceBand(cellText(cells, idxPriceBand));
            IpoDto dto = new IpoDto(
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
                    null, null,                                         // logoUrl, about — filled in later by detail-page enrichment
                    null, null,                                        // refundDate, dematDate — not on this page
                    null, null, null,                                   // faceValue, freshIssue, offerForSale — not on this page
                    null, null, null,                                   // tickerSymbol, strengths, risks — filled in later by detail-page enrichment
                    null                                                // financials — filled in later by detail-page enrichment
            );
            result.add(new RowWithDetailUrl(dto, resolveDetailUrl(row)));
        }
        return result;
    }

    /**
     * Resolves one data row's detail-page URL from its first anchor's {@code href}, resolved to
     * absolute against the list page's base URI. {@code TODO(verify)}: confirmed only against a
     * synthetic fixture — on the live page confirm the company-name cell is indeed the one carrying
     * the detail-page anchor. A row without any anchor yields {@code null}, so its enrichment is
     * simply skipped (the core list row for it is unaffected).
     */
    private static String resolveDetailUrl(Element row) {
        Element anchor = row.selectFirst("a[href]");
        String url = anchor == null ? null : anchor.absUrl("href");
        return url == null || url.isBlank() ? null : url;
    }

    /**
     * Fetches and parses one IPO's detail page for About/Strengths/Risks/Financials — a SEPARATE
     * HTTP round-trip per IPO on top of the single list-page fetch. Acceptable cost: the mainboard
     * list is only ever ~10-20 active IPOs, and this adapter runs on a periodic background poll,
     * never per-request. ANY failure here (network, anti-bot block, unexpected shape) is logged
     * and swallowed — returns {@code dto} unchanged so the IPO keeps its core list data and the
     * failure never propagates out of {@link #fetchAll()}.
     */
    private IpoDto enrichFromDetailPage(IpoDto dto, String detailUrl) {
        if (detailUrl == null || detailUrl.isBlank()) {
            return dto;
        }
        try {
            IpoHttpResponse response = httpClient.get(detailUrl, Map.of(
                    HttpHeaders.USER_AGENT, USER_AGENT,
                    HttpHeaders.ACCEPT, "text/html"
            ));
            Document detailDoc = Jsoup.parse(response.body(), detailUrl);
            return withDetailEnrichment(dto, parseDetail(detailDoc));
        } catch (Exception e) {
            log.warn("Chittorgarh: detail page fetch/parse failed for {}: {}", detailUrl, e.toString());
            return dto;
        }
    }

    /**
     * Extracted for unit testing without HTTP — parses a detail page already fetched into a
     * Document.
     *
     * <p>Strengths and risks headings are resolved separately, on purpose: a combined heading such
     * as "Strengths and Risks" matches BOTH {@link #STRENGTHS_HEADING} and {@link #RISKS_HEADING}
     * (they're independent substring-ish patterns), so naively looking each up via {@code
     * findHeading(doc, pattern)} would return the SAME element for both and duplicate its bullet
     * list into both fields. Instead the strengths heading is resolved first, then the risks
     * heading is looked up while excluding that exact element — if no OTHER heading matches
     * {@link #RISKS_HEADING}, risks is left {@code null} rather than duplicating strengths.
     */
    DetailEnrichment parseDetail(Document doc) {
        Element strengthsHeading = findHeading(doc, STRENGTHS_HEADING, null);
        Element risksHeading = findHeading(doc, RISKS_HEADING, strengthsHeading);
        return new DetailEnrichment(
                extractAbout(doc),
                extractBullets(strengthsHeading),
                extractBullets(risksHeading),
                extractFinancials(doc)
        );
    }

    /** One detail page's scraped enrichment fields, merged onto the list-row dto by {@link #withDetailEnrichment}. */
    record DetailEnrichment(String about, String strengths, String risks, List<IpoFinancialRowDto> financials) {}

    private static IpoDto withDetailEnrichment(IpoDto dto, DetailEnrichment enrichment) {
        return new IpoDto(dto.source(), dto.matchKey(), dto.companyName(), dto.ipoType(), dto.status(),
                dto.openDate(), dto.closeDate(), dto.allotmentDate(), dto.listingDate(),
                dto.priceMin(), dto.priceMax(), dto.lotSize(), dto.issueSize(),
                dto.listingExchange(), dto.listingPrice(), dto.listingGainPct(),
                dto.gmp(), dto.gmpPct(), dto.subscriptionCategories(), dto.subTotal(),
                dto.allotmentStatus(), dto.registrar(), dto.registrarUrl(), dto.logoUrl(), enrichment.about(),
                dto.refundDate(), dto.dematDate(), dto.faceValue(), dto.freshIssue(), dto.offerForSale(),
                dto.tickerSymbol(), enrichment.strengths(), enrichment.risks(), enrichment.financials());
    }

    /**
     * The "About {Company}" description: the run of {@code <p>} elements starting at the first
     * {@code <p>} found within {@value #MAX_SIBLING_HOPS} sibling hops of the heading whose text
     * starts with "About" (case-insensitive) — via the same wrapper-tolerant {@link #findFollowing}
     * traversal used by {@link #extractBullets}/{@link #extractFinancials}, so an About paragraph
     * wrapped in an intermediate {@code <div>} (rather than being a direct sibling of the heading)
     * isn't silently missed. Collection stops at the first non-{@code <p>} sibling of that first
     * paragraph (e.g. the next section's heading). {@code null} if no such heading, or no paragraph
     * is found.
     */
    private static String extractAbout(Document doc) {
        Element heading = findHeading(doc, ABOUT_HEADING, null);
        if (heading == null) {
            return null;
        }
        Element firstParagraph = findFollowing(heading, "p");
        if (firstParagraph == null) {
            return null;
        }
        List<String> paragraphs = new ArrayList<>();
        Element sibling = firstParagraph;
        while (sibling != null && "p".equalsIgnoreCase(sibling.tagName())) {
            String text = sibling.text().trim();
            if (!text.isEmpty()) {
                paragraphs.add(text);
            }
            sibling = sibling.nextElementSibling();
        }
        return paragraphs.isEmpty() ? null : String.join(" ", paragraphs);
    }

    /**
     * A bullet list (newline-delimited, matching how the entity stores strengths/risks) found
     * after the given heading element — e.g. the "Strengths" or "Risks"/"Weaknesses" heading
     * already resolved by {@link #parseDetail}. {@code null} if {@code heading} is {@code null}, or
     * no {@code <ul>}/{@code <ol>} is found within {@value #MAX_SIBLING_HOPS} sibling hops of it.
     */
    private static String extractBullets(Element heading) {
        if (heading == null) {
            return null;
        }
        Element list = findFollowing(heading, "ul,ol");
        if (list == null) {
            return null;
        }
        List<String> items = list.select("li").eachText();
        return items.isEmpty() ? null : String.join("\n", items);
    }

    /**
     * The "Company Financials" table found after the first heading whose text matches
     * {@link #FINANCIALS_HEADING}; empty if no matching heading, or no {@code <table>} is found
     * within {@value #MAX_SIBLING_HOPS} sibling hops of it.
     */
    private static List<IpoFinancialRowDto> extractFinancials(Document doc) {
        Element heading = findHeading(doc, FINANCIALS_HEADING, null);
        if (heading == null) {
            return List.of();
        }
        Element table = findFollowing(heading, "table");
        return table == null ? List.of() : parseFinancialsTable(table);
    }

    private static List<IpoFinancialRowDto> parseFinancialsTable(Element table) {
        List<String> headers = resolveHeaders(table);
        int idxPeriod = findColumn(headers, H_FIN_PERIOD);
        int idxRevenue = findColumn(headers, H_FIN_REVENUE);
        int idxPat = findColumn(headers, H_FIN_PAT);
        int idxAssets = findColumn(headers, H_FIN_ASSETS);

        List<IpoFinancialRowDto> rows = new ArrayList<>();
        for (Element row : resolveDataRows(table)) {
            Elements cells = row.select("td");
            if (cells.isEmpty()) {
                continue;
            }
            String fiscalYear = cellText(cells, idxPeriod);
            if (fiscalYear == null) {
                continue; // no usable period label for this row
            }
            rows.add(new IpoFinancialRowDto(
                    fiscalYear,
                    derivePeriodEnd(fiscalYear),
                    toFinancialDecimal(cellText(cells, idxRevenue)),
                    toFinancialDecimal(cellText(cells, idxPat)),
                    toFinancialDecimal(cellText(cells, idxAssets))
            ));
        }
        return rows;
    }

    /**
     * First element matching {@code heading}, {@code strong}, or {@code b} whose own text matches
     * {@code pattern} (case-insensitive), in document order — skipping {@code exclude} if given.
     * Chittorgarh's detail-page markup carries no stable semantic classes/ids for these sections,
     * so text-based heading matching is the least brittle option available (mirrors the
     * header-text column matching in {@link #findColumn}).
     *
     * <p>{@code exclude} lets a caller rule out a heading element already claimed by a different
     * field — e.g. a combined "Strengths and Risks" heading matches both {@link #STRENGTHS_HEADING}
     * and {@link #RISKS_HEADING}; once it's been claimed as the strengths heading, looking up risks
     * with {@code exclude} set to that element ensures risks isn't resolved to the very same
     * element (and so doesn't duplicate its bullet list).
     */
    private static Element findHeading(Document doc, Pattern pattern, Element exclude) {
        for (Element el : doc.select(HEADING_SELECTOR)) {
            if (el.equals(exclude)) {
                continue;
            }
            String text = el.text();
            if (text != null && pattern.matcher(text.trim()).matches()) {
                return el;
            }
        }
        return null;
    }

    /**
     * Walks {@code heading}'s following siblings (up to {@value #MAX_SIBLING_HOPS} hops) looking
     * for the first element matching {@code selector} — either the sibling itself, or nested
     * inside it (the target content is sometimes wrapped in an intermediate {@code <div>} rather
     * than being a direct sibling of the heading).
     */
    private static Element findFollowing(Element heading, String selector) {
        Element sibling = heading.nextElementSibling();
        int hops = 0;
        while (sibling != null && hops < MAX_SIBLING_HOPS) {
            if (sibling.is(selector)) {
                return sibling;
            }
            Element nested = sibling.selectFirst(selector);
            if (nested != null) {
                return nested;
            }
            sibling = sibling.nextElementSibling();
            hops++;
        }
        return null;
    }

    /**
     * Best-effort derivation of a chronological sort key from a fiscal-year/period display label —
     * never throws; returns {@code null} for anything unrecognised. Recognises "FY 2022-23" /
     * "FY2022-23" (period end = 31 Mar of the second year), "FY23" (period end = 31 Mar 2023),
     * "Mar 2023" / "March 2023" (last day of that month), and plain ISO dates (via
     * {@link IpoDateParser}). {@code TODO(verify)}: confirm the live page's actual label format(s)
     * — this covers the formats documented/observed elsewhere in this codebase's sample data, not
     * a confirmed live response.
     */
    private static LocalDate derivePeriodEnd(String label) {
        if (label == null || label.isBlank()) {
            return null;
        }
        String trimmed = label.trim();

        Matcher rangeMatcher = FY_RANGE.matcher(trimmed);
        if (rangeMatcher.find()) {
            Integer year = normalizeYear(rangeMatcher.group(2));
            if (year != null) {
                return LocalDate.of(year, 3, 31);
            }
        }
        Matcher singleMatcher = FY_SINGLE.matcher(trimmed);
        if (singleMatcher.find()) {
            Integer year = normalizeYear(singleMatcher.group(1));
            if (year != null) {
                return LocalDate.of(year, 3, 31);
            }
        }
        try {
            return YearMonth.parse(trimmed, MONTH_YEAR_SHORT).atEndOfMonth();
        } catch (DateTimeParseException ignored) {
            // fall through
        }
        try {
            return YearMonth.parse(trimmed, MONTH_YEAR_FULL).atEndOfMonth();
        } catch (DateTimeParseException ignored) {
            // fall through
        }
        return IpoDateParser.parse(trimmed);
    }

    /** "23" -&gt; 2023 (2-digit fiscal-year shorthand); a 4-digit year passes through unchanged. */
    private static Integer normalizeYear(String raw) {
        if (raw == null) {
            return null;
        }
        try {
            int value = Integer.parseInt(raw);
            return raw.length() <= 2 ? 2000 + value : value;
        } catch (NumberFormatException e) {
            return null;
        }
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

    /**
     * Like {@link #toDecimal} but for P&amp;L figures, which (unlike a price band) CAN be
     * negative — a loss-making year's PAT — reported either as a leading "-971.00" or in
     * accounting parenthesis notation "(971.00)". Strips currency symbols/commas; null-safe.
     */
    private static BigDecimal toFinancialDecimal(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String trimmed = raw.trim();
        boolean negative = trimmed.startsWith("(") && trimmed.endsWith(")");
        if (negative) {
            trimmed = trimmed.substring(1, trimmed.length() - 1);
        }
        String cleaned = trimmed.replaceAll("[^0-9.\\-]", "");
        if (cleaned.isEmpty() || "-".equals(cleaned) || ".".equals(cleaned)) {
            return null;
        }
        try {
            BigDecimal value = new BigDecimal(cleaned);
            return negative ? value.negate() : value;
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
