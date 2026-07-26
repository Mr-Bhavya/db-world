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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.Year;
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
 * Fallback / gap-fill source: scrapes Chittorgarh's IPO list page (Mainboard + SME, the
 * {@code /all/} tab) with Jsoup, then (best-effort) a BOUNDED subset of listed IPOs' own detail
 * pages for About/Strengths/Risks/Financials.
 *
 * <p>The list URL and its column set below ARE confirmed against a live-page screenshot (unlike
 * this adapter's earlier revision, which mapped a stale, 301-redirecting URL never actually seen
 * live) — see {@link #listUrl()}: {@code
 * https://www.chittorgarh.com/report/ipo-in-india-list-main-board-sme/82/all/?year=<current-year>}.
 * The {@code /all/} tab carries EVERY IPO for the whole calendar year (mainboard + SME, ~147 rows
 * incl. long-listed ones), so this adapter still can't fetch a live page from this environment
 * (server-side requests are blocked) to confirm the DETAIL page's own structure — that half
 * remains {@code TODO(verify)}. We fetch the HTML through the shared {@link IpoHttpClient} (same
 * retry policy as the other sources) and hand the body to Jsoup purely for DOM parsing/selection,
 * not networking.
 *
 * <p>The table-parsing logic is deliberately extracted into {@link #parseTable(Document)} so it
 * can be unit tested against a synthesized HTML fixture without any HTTP involved. Column
 * matching is done by header text (case-insensitive, tolerant of reordering) rather than fixed
 * indices or generated CSS classes/ids — Chittorgarh's markup carries no stable semantic
 * classes/ids per cell, so header-text matching is the least brittle option available. Three of
 * the real page's columns are deliberately NOT mapped: "Pricing Method" and "Issue Amount
 * (Rs.Cr.)" (redundant with "Total Issue Amount") have no dedicated {@link IpoDto} field, and
 * "Left Lead Manager" is the lead manager — NOT the registrar — so it is never written to {@link
 * IpoDto#registrar()}.
 *
 * <p><b>Detail-page enrichment, BOUNDED</b>: each list row's company-name cell is assumed to
 * carry an anchor linking to that IPO's own Chittorgarh detail page ({@code TODO(verify)} —
 * confirmed only against a synthetic fixture, never a live page). That detail-page URL is
 * resolved from the SAME row element used to build the row's {@link IpoDto} — see {@code
 * parseRows(Document)} — so an empty/spacer row (e.g. an ad or divider row with no {@code <td>}
 * cells) is skipped identically for both and can never desynchronise a dto from a different row's
 * detail URL. Given the list now covers the WHOLE year (~147 rows, not just ~10-20 active ones),
 * {@link #fetchAll()} only fetches the detail page for a bounded, relevant subset — rows that are
 * upcoming/open (no listing date yet) or listed within the last {@value
 * #RECENT_LISTING_WINDOW_DAYS} days, see {@link #isEligibleForDetailFetch(IpoDto)} — and hard-caps
 * the number of such fetches at {@value #MAX_DETAIL_FETCHES} (see {@link #MAX_DETAIL_FETCHES}) so
 * a busy year can never balloon into ~147 extra HTTP round-trips per poll. Rows outside that
 * subset simply keep their core list-row data, exactly as if they had no detail anchor. Every
 * enrichment step is best-effort: a missing section yields {@code null}/empty for just that
 * field, and ANY failure fetching/parsing one IPO's detail page (network, anti-bot block, shape
 * change) leaves that IPO's core list-row data untouched and never propagates out of {@link
 * #fetchAll()}.
 */
@Log4j2
@Component
public class ChittorgarhSource implements IpoSource {

    private static final String KEY = "chittorgarh";

    // ── Page confirmed live (screenshot) — TODO(verify): only the DETAIL page below is unconfirmed ──
    private static final String LIST_URL_TEMPLATE =
            "https://www.chittorgarh.com/report/ipo-in-india-list-main-board-sme/82/all/?year=%d";

    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    /**
     * Hard cap on the number of detail-page HTTP fetches per {@link #fetchAll()} call, on top of
     * the {@link #isEligibleForDetailFetch(IpoDto)} gate — the year list can carry ~147 rows, and
     * even the "active/recent" subset of that could exceed a sane per-poll fetch budget in a busy
     * IPO season.
     */
    private static final int MAX_DETAIL_FETCHES = 25;

    /**
     * A row is worth a detail-page fetch if it has no listing date yet (upcoming/open) or listed
     * within this many days of "today" — anything older is very unlikely to have changed and isn't
     * worth the extra round-trip.
     */
    private static final int RECENT_LISTING_WINDOW_DAYS = 30;

    // ── Column header aliases, mapped to the REAL list-page columns (live-page screenshot):
    // Company | Issue Category | Pricing Method | Opening Date | Closing Date | Listing Date |
    // Issue Price (Rs.) | Total Issue Amount (Incl.Firm Reservations) (Rs.Cr.) | Fresh Capital
    // (Rs.Cr.) | Offer For Sale (Rs.Cr.) | Issue Amount (Rs.Cr.) | Listing At | Left Lead Manager |
    // Compare ────────────────────────────────────────────────────────────────────────────────
    private static final List<String> H_NAME = List.of("company", "ipo name", "ipo");
    private static final List<String> H_ISSUE_CATEGORY = List.of("issue category");
    private static final List<String> H_OPEN = List.of("opening date", "open date", "open");
    private static final List<String> H_CLOSE = List.of("closing date", "close date", "close");
    private static final List<String> H_LISTING_DATE = List.of("listing date");
    // NOTE: no bare "price" alias — it's a substring of "listing price" and would mismatch that column.
    private static final List<String> H_ISSUE_PRICE = List.of("issue price", "price band", "price range", "price (rs)");
    private static final List<String> H_TOTAL_ISSUE_AMOUNT = List.of("total issue amount", "issue size");
    private static final List<String> H_FRESH_CAPITAL = List.of("fresh capital");
    private static final List<String> H_OFFER_FOR_SALE = List.of("offer for sale");
    private static final List<String> H_LISTING_AT = List.of("listing at");

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
    private final Clock clock;

    @Autowired
    public ChittorgarhSource(IpoHttpClient httpClient) {
        this(httpClient, Clock.systemUTC());
    }

    /** Test-friendly constructor with an injectable clock for deterministic year/gate tests. */
    ChittorgarhSource(IpoHttpClient httpClient, Clock clock) {
        this.httpClient = httpClient;
        this.clock = clock;
    }

    @Override
    public String key() {
        return KEY;
    }

    /** The list URL for the CURRENT calendar year, e.g. {@code .../82/all/?year=2026}. */
    private String listUrl() {
        return LIST_URL_TEMPLATE.formatted(Year.now(clock).getValue());
    }

    @Override
    public List<IpoDto> fetchAll() {
        String listUrl = listUrl();
        try {
            IpoHttpResponse response = httpClient.get(listUrl, Map.of(
                    HttpHeaders.USER_AGENT, USER_AGENT,
                    HttpHeaders.ACCEPT, "text/html"
            ));
            Document doc = Jsoup.parse(response.body(), listUrl);
            List<RowWithDetailUrl> rows = parseRows(doc);

            List<IpoDto> result = new ArrayList<>(rows.size());
            int detailFetchesRemaining = MAX_DETAIL_FETCHES;
            for (RowWithDetailUrl row : rows) {
                IpoDto dto = row.dto();
                if (detailFetchesRemaining > 0 && row.detailUrl() != null && isEligibleForDetailFetch(dto)) {
                    dto = enrichFromDetailPage(dto, row.detailUrl());
                    detailFetchesRemaining--;
                }
                result.add(dto);
            }
            return result;
        } catch (Exception e) {
            log.warn("Chittorgarh fetch failed: {}", e.toString());
            return List.of();
        }
    }

    /**
     * Bounds detail-page enrichment to a relevant subset (see class javadoc): upcoming/open IPOs
     * (no listing date reported yet) or ones that listed within the last {@value
     * #RECENT_LISTING_WINDOW_DAYS} days. A future listing date (an upcoming IPO whose listing date
     * is already announced) also counts as eligible, since it's not "before" the cutoff either.
     */
    private boolean isEligibleForDetailFetch(IpoDto dto) {
        LocalDate listingDate = dto.listingDate();
        if (listingDate == null) {
            return true;
        }
        LocalDate cutoff = LocalDate.now(clock).minusDays(RECENT_LISTING_WINDOW_DAYS);
        return !listingDate.isBefore(cutoff);
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
     * Parses the mainboard+SME list table into one {@link RowWithDetailUrl} per data row, in a
     * single pass. Building the dto and resolving its detail-page URL from the SAME {@code row}
     * element —
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
        int idxCategory = findColumn(headers, H_ISSUE_CATEGORY);
        int idxOpen = findColumn(headers, H_OPEN);
        int idxClose = findColumn(headers, H_CLOSE);
        int idxListing = findColumn(headers, H_LISTING_DATE);
        int idxIssuePrice = findColumn(headers, H_ISSUE_PRICE);
        int idxTotalIssueAmount = findColumn(headers, H_TOTAL_ISSUE_AMOUNT);
        int idxFreshCapital = findColumn(headers, H_FRESH_CAPITAL);
        int idxOfferForSale = findColumn(headers, H_OFFER_FOR_SALE);
        int idxListingAt = findColumn(headers, H_LISTING_AT);
        // "Pricing Method", "Issue Amount (Rs.Cr.)", "Left Lead Manager" and "Compare" are real
        // columns on this page but have no dedicated IpoDto field (or, for Left Lead Manager, are
        // NOT the registrar) — see class javadoc — so no index is resolved for them.

        List<RowWithDetailUrl> result = new ArrayList<>();
        for (Element row : resolveDataRows(table)) {
            Elements cells = row.select("td");
            if (cells.isEmpty()) {
                continue;
            }
            BigDecimal[] priceBand = parseIssuePriceBand(cellText(cells, idxIssuePrice));
            IpoDto dto = new IpoDto(
                    KEY,                                  // source
                    null,                                 // matchKey — assigned later by the normaliser
                    cellText(cells, idxName),               // companyName
                    cellText(cells, idxCategory),            // ipoType — raw "Mainboard"/"SME"; ingest canonicalizes
                    null,                                     // status — not derivable from this table
                    parseDate(cellText(cells, idxOpen)),        // openDate
                    parseDate(cellText(cells, idxClose)),        // closeDate
                    null,                                          // allotmentDate — no such column on this page
                    parseDate(cellText(cells, idxListing)),        // listingDate
                    priceBand[0],                                   // priceMin
                    priceBand[1],                                    // priceMax
                    null,                                             // lotSize — no such column on this page
                    parseIssueSizeLabel(cellText(cells, idxTotalIssueAmount)), // issueSize, e.g. "₹39.04 Cr"
                    parseListingExchange(cellText(cells, idxListingAt)),        // listingExchange: BOTH/NSE/BSE
                    null,                                               // listingPrice
                    null,                                               // listingGainPct — no such column on this page
                    null, null,                                        // gmp, gmpPct
                    null, null,                                        // subscriptionCategories, subTotal
                    null,                                               // allotmentStatus
                    null, null,                                         // registrar, registrarUrl — "Left Lead Manager" is NOT the registrar
                    null, null,                                         // logoUrl, about — filled in later by detail-page enrichment
                    null, null,                                        // refundDate, dematDate — not on this page
                    null,                                              // faceValue — not on this page
                    toDecimal(cellText(cells, idxFreshCapital)),       // freshIssue
                    toDecimal(cellText(cells, idxOfferForSale)),       // offerForSale
                    null,                                              // tickerSymbol
                    null, null,                                        // strengths, risks — filled in later by detail-page enrichment
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
     * HTTP round-trip per IPO on top of the single list-page fetch. ANY failure here (network,
     * anti-bot block, unexpected shape) is logged and swallowed — returns {@code dto} unchanged so
     * the IPO keeps its core list data and the failure never propagates out of {@link #fetchAll()}.
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
     * Splits a "151.00 to 159.00"-style "Issue Price (Rs.)" cell into {@code [min, max]}. Per the
     * confirmed live-page format, ONLY a proper two-sided "X to Y" band yields a real result — a
     * single value with no "to" separator, a "0.00 to 0.00" not-yet-priced placeholder, or a blank
     * cell all yield {@code [null, null]} rather than a fabricated equal-bounds band.
     */
    private static BigDecimal[] parseIssuePriceBand(String raw) {
        if (raw == null || raw.isBlank()) {
            return new BigDecimal[] {null, null};
        }
        String[] parts = raw.trim().split("(?i)\\s+to\\s+");
        if (parts.length != 2) {
            return new BigDecimal[] {null, null};
        }
        BigDecimal min = toDecimal(parts[0]);
        BigDecimal max = toDecimal(parts[1]);
        if (min == null || max == null || min.signum() == 0 || max.signum() == 0) {
            return new BigDecimal[] {null, null};
        }
        return new BigDecimal[] {min, max};
    }

    /**
     * Builds a readable issue-size label such as {@code "₹39.04 Cr"} / {@code "₹1,800.00 Cr"} from
     * the "Total Issue Amount (Incl.Firm Reservations) (Rs.Cr.)" cell — kept verbatim, comma
     * thousands and all, for display; {@link #toDecimal} (which already strips commas) is only
     * used here to confirm the cell actually holds a number. {@code null} for a blank/unparseable
     * cell.
     */
    private static String parseIssueSizeLabel(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String trimmed = raw.trim();
        if (toDecimal(trimmed) == null) {
            return null;
        }
        return "₹" + trimmed + " Cr";
    }

    /**
     * Normalizes the "Listing At" cell ("BSE, NSE" / "BSE SME" / "NSE SME") to {@code BOTH} /
     * {@code NSE} / {@code BSE} — the "SME" suffix is irrelevant to which exchange(s) list the
     * IPO, so it's ignored (a plain substring check for "NSE"/"BSE" is unaffected by it either
     * way). {@code null} for a blank/unrecognised cell.
     */
    private static String parseListingExchange(String raw) {
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

}
