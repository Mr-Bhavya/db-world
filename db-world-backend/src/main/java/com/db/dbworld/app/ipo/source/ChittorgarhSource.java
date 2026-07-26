package com.db.dbworld.app.ipo.source;

import com.db.dbworld.app.ipo.dto.IpoDto;
import com.db.dbworld.app.ipo.dto.IpoFinancialRowDto;
import com.db.dbworld.app.ipo.source.support.IpoDateParser;
import com.db.dbworld.app.ipo.source.support.IpoHttpClient;
import com.db.dbworld.app.ipo.source.support.IpoHttpResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.db.dbworld.app.ipo.source.support.IpoJsonUtil.text;

/**
 * Fallback / gap-fill source: reads Chittorgarh's IPO list from its (undocumented but confirmed)
 * JSON API, then (best-effort) a BOUNDED subset of listed IPOs' own HTML detail pages for
 * About/Strengths/Risks/Financials.
 *
 * <p><b>List = JSON API</b>. The public HTML report page renders its table client-side via AJAX,
 * so a server-side Jsoup scrape of it returns nothing ("no {@code <table>}"). The page's own XHR
 * hits {@code webnodejs.chittorgarh.com}, which returns the rows as JSON — that endpoint is what
 * this adapter now calls (a real request URL + response body were captured from the browser's
 * DevTools Network tab and the field mapping below is taken straight from that sample, not
 * guessed). See {@link #listUrl(int)}: {@code
 * https://webnodejs.chittorgarh.com/cloud/report/data-read/82/<page>/7/<fyStart>/<fy>/0/all}
 * where {@code <fyStart>} is the Indian financial-year start year and {@code <fy>} its
 * {@code YYYY-YY} label (e.g. {@code 2026} + {@code 2026-27}), both computed in IST. The
 * {@code /all} tab carries both mainboard and SME rows (each row's {@code "Issue Category"} says
 * which). The response reports {@code totalPages}; we page through it up to {@link #MAX_PAGES}.
 *
 * <p><b>Detail = HTML</b> (unchanged). Each row's {@code "Company"} cell is an HTML anchor whose
 * {@code href} is that IPO's Chittorgarh detail-page URL. Those detail pages are server-rendered
 * HTML (not JSON), so About/Strengths/Risks/Financials are still scraped with Jsoup — but that
 * host blocks server-side requests from some environments, so this half remains
 * {@code TODO(verify)} against a live page and is entirely best-effort: any failure leaves the
 * IPO's core list-row data intact and never propagates out of {@link #fetchAll()}. Given the
 * year list can carry many rows, {@link #fetchAll()} only fetches the detail page for a bounded,
 * relevant subset — rows that are upcoming/open (no listing date yet) or listed within the last
 * {@value #RECENT_LISTING_WINDOW_DAYS} days, see {@link #isEligibleForDetailFetch(IpoDto)} — and
 * hard-caps the number of such fetches at {@value #MAX_DETAIL_FETCHES}.
 */
@Log4j2
@Component
public class ChittorgarhSource implements IpoSource {

    private static final String KEY = "chittorgarh";

    // ── List JSON endpoint (confirmed from a live DevTools capture) ──────────────────────────────
    // Path segments: report-id(82) / page / <const 7> / fyStartYear / fyLabel / <const 0> / tab(all)
    private static final String LIST_URL_TEMPLATE =
            "https://webnodejs.chittorgarh.com/cloud/report/data-read/82/%d/7/%d/%s/0/all";

    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    // The JSON API is a cross-origin XHR the report page makes; mirror the browser's Origin/Referer
    // so a same-origin check on webnodejs can't reject a bare server-side call. TODO(verify) live.
    private static final String CHITTORGARH_ORIGIN = "https://www.chittorgarh.com";

    // This is an India-context site (list contents are keyed to the Indian IPO calendar), so the
    // financial-year in the URL must roll over at IST midnight, not UTC midnight — same reasoning as
    // the ipo-poll cron already being pinned to Asia/Kolkata.
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    /** Hard cap on list pages walked per {@link #fetchAll()} — guards against a runaway page count. */
    private static final int MAX_PAGES = 20;

    /**
     * Hard cap on the number of detail-page HTTP fetches per {@link #fetchAll()} call, on top of
     * the {@link #isEligibleForDetailFetch(IpoDto)} gate — the year list can carry many rows, and
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

    // ── List JSON field names (verbatim from the captured response — case/spacing matter) ─────────
    private static final String F_REPORT_DATA = "reportTableData";
    private static final String F_TOTAL_PAGES = "totalPages";
    private static final String F_COMPANY = "Company";                 // HTML anchor: name + detail href
    private static final String F_ISSUE_CATEGORY = "Issue Category";     // "SME" | "Mainboard"
    private static final String F_OPENING_DATE = "Opening Date";          // "31-Dec-2025"
    private static final String F_CLOSING_DATE = "Closing Date";
    private static final String F_LISTING_DATE = "Listing Date";
    private static final String F_ISSUE_PRICE = "Issue Price (Rs.)";       // "90.00" or "120.00 to 127.00"
    private static final String F_TOTAL_ISSUE_AMOUNT = "Total Issue Amount (Incl.Firm reservations) (Rs.cr.)";
    private static final String F_FRESH_CAPITAL = "Fresh Capital (Rs.cr.)";
    private static final String F_OFFER_FOR_SALE = "Offer for sale (Rs.cr.)";
    private static final String F_LISTING_AT = "Listing at";                // "BSE SME" | "NSE SME" | "BSE, NSE"
    private static final String F_COMPARE_IMAGE = "~compare_image";          // real logo image URL
    private static final String F_NSE_SYMBOL = "~nse_symbol";                 // ticker once listed on NSE
    private static final String F_BSE_CODE = "~bse_script_code";              // scrip code once listed on BSE

    // ── Detail-page extraction. The detail page is a Next.js SSR page that exposes the "About"
    // block and the financials table under STABLE ids (#ipoSummary, #financialTable) — used
    // directly below (confirmed against a live capture, Xtranet 2688) — with heading-text matching
    // kept only as a fallback. The financials table is TRANSPOSED: metrics run down the first
    // column, fiscal periods across the header row. There is no dedicated risks/weaknesses
    // section on the detail page (only competitive strengths), so risks is left null. ───────────
    private static final Pattern ABOUT_HEADING = Pattern.compile("^about\\b.*", Pattern.CASE_INSENSITIVE);
    private static final Pattern FINANCIALS_HEADING = Pattern.compile(".*financials?.*", Pattern.CASE_INSENSITIVE);
    private static final String HEADING_SELECTOR = "h1,h2,h3,h4,h5,strong,b";
    /** Financials metric-row labels (first cell of each transposed data row), matched case-insensitively. */
    private static final List<String> FIN_REVENUE = List.of("total income", "revenue");
    private static final List<String> FIN_PAT = List.of("profit after tax", "net profit", "pat");
    private static final List<String> FIN_ASSETS = List.of("total assets", "assets");
    /** A short line (≤ this many chars) mentioning "strength" marks the start of the strengths bullet list. */
    private static final int STRENGTHS_LABEL_MAX_LEN = 40;
    /** Bails out of the heading→content sibling walk after this many hops so a shape mismatch can't loop indefinitely. */
    private static final int MAX_SIBLING_HOPS = 6;

    private static final Pattern FY_RANGE = Pattern.compile("FY\\s*-?\\s*(\\d{2,4})\\s*[-/]\\s*(\\d{2,4})", Pattern.CASE_INSENSITIVE);
    private static final Pattern FY_SINGLE = Pattern.compile("FY\\s*-?\\s*(\\d{2,4})\\b", Pattern.CASE_INSENSITIVE);
    private static final DateTimeFormatter DAY_MONTH_YEAR = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter MONTH_YEAR_SHORT = DateTimeFormatter.ofPattern("MMM yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter MONTH_YEAR_FULL = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.ENGLISH);

    private static final ObjectMapper MAPPER = new ObjectMapper();

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

    /**
     * The list JSON URL for a given page of the CURRENT Indian financial year. The FY is computed
     * in IST (not the injected clock's own zone, which defaults to UTC) since this is an
     * India-context site: the FY starts on 1 April, so for a "today" in Apr–Dec the FY start year
     * is the current year, and for Jan–Mar it's the previous year (e.g. IST 26-Jul-2026 →
     * {@code fyStart=2026}, {@code fyLabel=2026-27}; IST 15-Feb-2026 → {@code 2025} / {@code 2025-26}).
     */
    String listUrl(int page) {
        ZonedDateTime nowIst = ZonedDateTime.now(clock.withZone(IST));
        int fyStart = nowIst.getMonthValue() >= 4 ? nowIst.getYear() : nowIst.getYear() - 1;
        String fyLabel = fyStart + "-" + String.format(Locale.ROOT, "%02d", (fyStart + 1) % 100);
        return LIST_URL_TEMPLATE.formatted(page, fyStart, fyLabel);
    }

    @Override
    public List<IpoDto> fetchAll() {
        List<RowWithDetailUrl> rows;
        try {
            rows = fetchList();
        } catch (Exception e) {
            log.warn("Chittorgarh list fetch failed: {}", e.toString());
            return List.of();
        }

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
    }

    /** Walks the paginated JSON list endpoint (bounded by {@link #MAX_PAGES}), accumulating rows. */
    private List<RowWithDetailUrl> fetchList() throws Exception {
        List<RowWithDetailUrl> all = new ArrayList<>();
        int page = 1;
        while (page <= MAX_PAGES) {
            IpoHttpResponse response = httpClient.get(listUrl(page), jsonHeaders());
            JsonNode root = MAPPER.readTree(response.body());
            all.addAll(parseRows(root));
            int totalPages = root.path(F_TOTAL_PAGES).asInt(1);
            if (page >= totalPages) {
                break;
            }
            page++;
        }
        return all;
    }

    private static Map<String, String> jsonHeaders() {
        return Map.of(
                HttpHeaders.USER_AGENT, USER_AGENT,
                HttpHeaders.ACCEPT, "application/json, text/plain, */*",
                HttpHeaders.REFERER, CHITTORGARH_ORIGIN + "/",
                HttpHeaders.ORIGIN, CHITTORGARH_ORIGIN
        );
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
     * One data row's parsed {@link IpoDto} paired with that same row's detail-page URL — resolved
     * from the SAME JSON node so the two can never desynchronise.
     */
    private record RowWithDetailUrl(IpoDto dto, String detailUrl) {}

    /** Company-name cell parsed into its display name and (absolute) detail-page URL. */
    private record ParsedCompany(String name, String detailUrl) {}

    /** Extracted for unit testing without HTTP — parses a JSON list-response body into row dtos. */
    List<IpoDto> parseList(String body) {
        try {
            List<RowWithDetailUrl> rows = parseRows(MAPPER.readTree(body));
            List<IpoDto> result = new ArrayList<>(rows.size());
            for (RowWithDetailUrl row : rows) {
                result.add(row.dto());
            }
            return result;
        } catch (Exception e) {
            log.warn("Chittorgarh: list JSON parse failed: {}", e.toString());
            return List.of();
        }
    }

    /**
     * Maps each element of the response's {@code reportTableData} array to one
     * {@link RowWithDetailUrl}. A row with no usable company name is skipped (nothing to key on).
     * Every field is null-safe: a missing/blank JSON field yields {@code null} for just that field.
     */
    private List<RowWithDetailUrl> parseRows(JsonNode root) {
        JsonNode array = root.path(F_REPORT_DATA);
        if (!array.isArray()) {
            log.warn("Chittorgarh: response has no '{}' array", F_REPORT_DATA);
            return List.of();
        }

        List<RowWithDetailUrl> rows = new ArrayList<>();
        for (JsonNode node : array) {
            ParsedCompany company = parseCompanyCell(text(node, F_COMPANY));
            if (company.name() == null) {
                continue;
            }
            BigDecimal[] priceBand = parseIssuePriceBand(text(node, F_ISSUE_PRICE));
            IpoDto dto = new IpoDto(
                    KEY,                                              // source
                    null,                                             // matchKey — assigned later by the normaliser
                    company.name(),                                   // companyName
                    text(node, F_ISSUE_CATEGORY),                     // ipoType — raw "SME"/"Mainboard"; ingest canonicalizes
                    null,                                             // status — not in the list JSON
                    parseDate(text(node, F_OPENING_DATE)),            // openDate
                    parseDate(text(node, F_CLOSING_DATE)),            // closeDate
                    null,                                             // allotmentDate — not in the list JSON
                    parseDate(text(node, F_LISTING_DATE)),            // listingDate
                    priceBand[0],                                     // priceMin
                    priceBand[1],                                     // priceMax
                    null,                                             // lotSize — not in the list JSON
                    parseIssueSizeLabel(text(node, F_TOTAL_ISSUE_AMOUNT)), // issueSize, e.g. "₹36.89 Cr"
                    parseListingExchange(text(node, F_LISTING_AT)),   // listingExchange: BOTH/NSE/BSE
                    null,                                             // listingPrice
                    null,                                             // listingGainPct
                    null, null,                                       // gmp, gmpPct
                    null, null,                                       // subscriptionCategories, subTotal
                    null,                                             // allotmentStatus
                    null, null,                                       // registrar, registrarUrl
                    logoUrl(node),                                    // logoUrl ← ~compare_image (real logo)
                    null,                                             // about — filled by detail-page enrichment
                    null, null,                                       // refundDate, dematDate
                    null,                                             // faceValue — not in the list JSON
                    toDecimal(text(node, F_FRESH_CAPITAL)),           // freshIssue
                    toDecimal(text(node, F_OFFER_FOR_SALE)),          // offerForSale
                    tickerSymbol(node),                               // tickerSymbol ← ~nse_symbol / ~bse_script_code
                    null, null,                                       // strengths, risks — filled by detail-page enrichment
                    null                                              // financials — filled by detail-page enrichment
            );
            rows.add(new RowWithDetailUrl(dto, company.detailUrl()));
        }
        return rows;
    }

    /**
     * Parses the {@code "Company"} cell — an HTML fragment like
     * {@code <a href="https://www.chittorgarh.com/ipo/foo-ipo/123/" title="...">Foo Ltd.</a>} — into
     * the company's display name (the anchor text, HTML entities decoded) and its absolute
     * detail-page URL (the anchor href, already absolute in the JSON). A fragment without an anchor
     * still yields its plain text as the name (detail URL {@code null}); a blank fragment yields
     * {@code (null, null)}.
     */
    private static ParsedCompany parseCompanyCell(String html) {
        if (html == null || html.isBlank()) {
            return new ParsedCompany(null, null);
        }
        Document fragment = Jsoup.parseBodyFragment(html);
        Element anchor = fragment.selectFirst("a[href]");
        if (anchor == null) {
            String text = fragment.text().trim();
            return new ParsedCompany(text.isBlank() ? null : text, null);
        }
        String name = anchor.text().trim();
        String href = anchor.attr("href").trim();
        return new ParsedCompany(
                name.isBlank() ? null : name,
                href.isBlank() || !href.startsWith("http") ? null : href);
    }

    /** The row's real logo image URL ({@code ~compare_image}), or {@code null} if absent/not http(s). */
    private static String logoUrl(JsonNode node) {
        String img = text(node, F_COMPARE_IMAGE);
        return img != null && (img.startsWith("http://") || img.startsWith("https://")) ? img.trim() : null;
    }

    /**
     * The stock identifier once listed: the NSE trading symbol ({@code ~nse_symbol}) if present,
     * otherwise the BSE scrip code ({@code ~bse_script_code}) as a string — one of the two is set
     * for a listed IPO, both blank for one still upcoming.
     */
    private static String tickerSymbol(JsonNode node) {
        String nse = text(node, F_NSE_SYMBOL);
        if (nse != null && !nse.isBlank()) {
            return nse.trim();
        }
        String bse = text(node, F_BSE_CODE);
        if (bse != null && !bse.isBlank() && !"0".equals(bse.trim())) {
            return bse.trim();
        }
        return null;
    }

    /**
     * Fetches and parses one IPO's HTML detail page for About/Strengths/Risks/Financials — a
     * SEPARATE HTTP round-trip per IPO on top of the JSON list fetch. ANY failure here (network,
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
     * Document. About + competitive strengths come from the {@code #ipoSummary} block; financials
     * from the transposed {@code #financialTable}; risks is always {@code null} (the detail page
     * has no dedicated risks/weaknesses section).
     */
    DetailEnrichment parseDetail(Document doc) {
        AboutAndStrengths as = extractAboutAndStrengths(doc);
        return new DetailEnrichment(as.about(), as.strengths(), null, extractFinancials(doc));
    }

    /** One detail page's scraped enrichment fields, merged onto the list-row dto by {@link #withDetailEnrichment}. */
    record DetailEnrichment(String about, String strengths, String risks, List<IpoFinancialRowDto> financials) {}

    /** The company "About" narrative and the competitive-strengths bullets, split out of {@code #ipoSummary}. */
    private record AboutAndStrengths(String about, String strengths) {}

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
     * Extracts the company "About" narrative and the "Competitive Strengths" bullets from the
     * detail page's {@code #ipoSummary} block (a stable id — far less brittle than heading-text
     * matching). Everything up to the "Competitive Strengths" label becomes the about text (intro
     * paragraphs + the "Business Offerings" list); the {@code <ul>} right after that label becomes
     * strengths. Falls back to a heading-based paragraph walk if the id is absent.
     */
    private static AboutAndStrengths extractAboutAndStrengths(Document doc) {
        Element summary = doc.getElementById("ipoSummary");
        if (summary == null) {
            return new AboutAndStrengths(extractAboutFallback(doc), null);
        }
        List<String> aboutParts = new ArrayList<>();
        String strengths = null;
        boolean inStrengths = false;
        for (Element el : summary.children()) {
            String text = el.text().trim();
            if (!inStrengths && isStrengthsLabel(text)) {
                inStrengths = true;
                continue;
            }
            if (inStrengths) {
                if (el.is("ul,ol")) {
                    List<String> items = el.select("li").eachText();
                    if (!items.isEmpty()) {
                        strengths = String.join("\n", items);
                    }
                    break;
                }
                continue;
            }
            if (el.is("ul,ol")) {
                for (String li : el.select("li").eachText()) {
                    if (!li.isBlank()) {
                        aboutParts.add(li.trim());
                    }
                }
            } else if (!text.isEmpty()) {
                aboutParts.add(text);
            }
        }
        return new AboutAndStrengths(aboutParts.isEmpty() ? null : String.join(" ", aboutParts), strengths);
    }

    /** A short bold-ish line mentioning "strength" (e.g. "Competitive Strengths") marks the strengths list. */
    private static boolean isStrengthsLabel(String text) {
        return text.length() <= STRENGTHS_LABEL_MAX_LEN && text.toLowerCase(Locale.ROOT).contains("strength");
    }

    /**
     * Fallback used only when {@code #ipoSummary} is absent: the run of {@code <p>} elements
     * following the first heading whose text starts with "About" (case-insensitive), via the
     * wrapper-tolerant {@link #findFollowing} traversal. {@code null} if no such heading/paragraph.
     */
    private static String extractAboutFallback(Document doc) {
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
     * The "Company Financials" table, found by its stable {@code #financialTable} id (falling back
     * to the first table after a "Financials" heading). Empty if neither locates a table.
     */
    private static List<IpoFinancialRowDto> extractFinancials(Document doc) {
        Element table = doc.getElementById("financialTable");
        if (table == null) {
            Element heading = findHeading(doc, FINANCIALS_HEADING, null);
            table = heading == null ? null : findFollowing(heading, "table");
        }
        return table == null ? List.of() : parseFinancialsTable(table);
    }

    /**
     * Parses Chittorgarh's TRANSPOSED financials table — metrics down the first column, fiscal
     * periods across the header row ({@code Period Ended | 31 Mar 2026 | 31 Mar 2025 | ...}) — into
     * one {@link IpoFinancialRowDto} per period column: Total Income → revenue, Profit After Tax →
     * pat, Assets → totalAssets. Metric/period lookups are null-safe; an absent metric row leaves
     * that figure {@code null} rather than dropping the whole period.
     */
    private static List<IpoFinancialRowDto> parseFinancialsTable(Element table) {
        List<String> headers = resolveHeaders(table);
        if (headers.size() < 2) {
            return List.of();
        }
        List<String> periods = headers.subList(1, headers.size());

        Map<String, List<String>> byMetric = new LinkedHashMap<>();
        for (Element row : table.select("tbody tr")) {
            Elements cells = row.select("td");
            if (cells.size() < 2) {
                continue;
            }
            String metric = cells.get(0).text().trim().toLowerCase(Locale.ROOT);
            List<String> values = new ArrayList<>();
            for (int i = 1; i < cells.size(); i++) {
                values.add(cells.get(i).text());
            }
            byMetric.putIfAbsent(metric, values);
        }

        List<String> revenueRow = findMetricRow(byMetric, FIN_REVENUE);
        List<String> patRow = findMetricRow(byMetric, FIN_PAT);
        List<String> assetsRow = findMetricRow(byMetric, FIN_ASSETS);

        List<IpoFinancialRowDto> rows = new ArrayList<>();
        for (int i = 0; i < periods.size(); i++) {
            String fiscalYear = periods.get(i) == null ? null : periods.get(i).trim();
            if (fiscalYear == null || fiscalYear.isEmpty()) {
                continue;
            }
            rows.add(new IpoFinancialRowDto(
                    fiscalYear,
                    derivePeriodEnd(fiscalYear),
                    toFinancialDecimal(valueAt(revenueRow, i)),
                    toFinancialDecimal(valueAt(patRow, i)),
                    toFinancialDecimal(valueAt(assetsRow, i))
            ));
        }
        return rows;
    }

    /** First metric row whose first-cell label equals or contains one of {@code aliases} (in order). */
    private static List<String> findMetricRow(Map<String, List<String>> byMetric, List<String> aliases) {
        for (String alias : aliases) {
            for (Map.Entry<String, List<String>> e : byMetric.entrySet()) {
                if (e.getKey().equals(alias) || e.getKey().contains(alias)) {
                    return e.getValue();
                }
            }
        }
        return null;
    }

    private static String valueAt(List<String> row, int index) {
        return row != null && index < row.size() ? row.get(index) : null;
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
            return LocalDate.parse(trimmed, DAY_MONTH_YEAR); // "31 Mar 2026" (Chittorgarh's period-end format)
        } catch (DateTimeParseException ignored) {
            // fall through
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

    private static LocalDate parseDate(String raw) {
        return IpoDateParser.parse(raw);
    }

    /**
     * Splits an "Issue Price (Rs.)" value into {@code [min, max]}. A two-sided "X to Y" band yields
     * both bounds; a single value (a fixed-price IPO, e.g. "90.00") yields equal bounds so the
     * price is preserved; a "0.00"/"0.00 to 0.00" not-yet-priced placeholder or a blank cell yields
     * {@code [null, null]}.
     */
    private static BigDecimal[] parseIssuePriceBand(String raw) {
        if (raw == null || raw.isBlank()) {
            return new BigDecimal[] {null, null};
        }
        String trimmed = raw.trim();
        String[] parts = trimmed.split("(?i)\\s+to\\s+");
        if (parts.length == 2) {
            BigDecimal min = toDecimal(parts[0]);
            BigDecimal max = toDecimal(parts[1]);
            if (min == null || max == null || min.signum() == 0 || max.signum() == 0) {
                return new BigDecimal[] {null, null};
            }
            return new BigDecimal[] {min, max};
        }
        BigDecimal single = toDecimal(trimmed);
        if (single == null || single.signum() == 0) {
            return new BigDecimal[] {null, null};
        }
        return new BigDecimal[] {single, single};
    }

    /**
     * Builds a readable issue-size label such as {@code "₹36.89 Cr"} / {@code "₹1,800.00 Cr"} from
     * the "Total Issue Amount (Incl.Firm reservations) (Rs.cr.)" value — kept verbatim, comma
     * thousands and all, for display; {@link #toDecimal} (which already strips commas) is only used
     * here to confirm the value actually holds a number. {@code null} for a blank/unparseable value.
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
     * Normalizes the "Listing at" value ("BSE, NSE" / "BSE SME" / "NSE SME") to {@code BOTH} /
     * {@code NSE} / {@code BSE} — the "SME" suffix is irrelevant to which exchange(s) list the IPO,
     * so it's ignored (a plain substring check for "NSE"/"BSE" is unaffected by it either way).
     * {@code null} for a blank/unrecognised value.
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
        // Strips currency symbols/commas (e.g. "₹163", "1,800.00") that can appear in a scraped cell.
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
