package com.db.dbworld.app.cinema.social;

import jakarta.servlet.http.HttpServletRequest;
import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.credits.entity.CreditEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.app.cinema.tmdb.enums.CreditType;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

import java.time.Duration;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Server-rendered HTML for SEARCH crawlers.
 *
 * <p><b>Why this is separate from {@link SocialPreviewController}.</b> That endpoint
 * serves social cards: {@code <head>}-only, plus a meta refresh to bounce a stray human
 * to the real URL. That shape is right for WhatsApp and wrong for Google — a document
 * with no body and a meta refresh reads as thin content behind a redirect, which is
 * about the worst thing to hand a search crawler. So social crawlers keep the endpoint
 * that already works for them, and search crawlers get this one, which renders a real
 * body plus JSON-LD.
 *
 * <p><b>This is dynamic rendering, not cloaking.</b> The distinction is whether the
 * crawler is shown materially different content from the visitor. Everything emitted
 * here — title, year, runtime, rating, synopsis, genres, cast — is what the SPA paints
 * on the same URL once its JavaScript runs. The crawler is getting the same content
 * earlier, not different content. Keep it that way: if the SPA stops showing something,
 * stop emitting it here too.
 *
 * <p>nginx routes search-engine User-Agents here, mirroring the existing social map in
 * {@code 10-app.conf} (db-world-config repo):
 * <pre>
 * map $http_user_agent $is_search_bot {
 *     default                      0;
 *     "~*googlebot|bingbot|duckduckbot|yandexbot|baiduspider"  1;
 * }
 * </pre>
 *
 * <p>{@code DRAFT} records are never rendered, matching the disclosure rule
 * {@link SocialPreviewController} and {@link SitemapController} both enforce.
 */
@RestController
@RequestMapping("/api/seo")
@Log4j2
@RequiredArgsConstructor
public class SeoRenderController {

    private static final String TMDB_IMG = "https://image.tmdb.org/t/p/";
    private static final Pattern NON_ALNUM = Pattern.compile("[^a-z0-9]+");
    private static final Pattern EDGE_DASH = Pattern.compile("^-+|-+$");

    /** How many titles an index page links to. Enough for discovery, not a full dump. */
    private static final int INDEX_LIMIT = 200;
    private static final int CAST_LIMIT = 12;

    private final RecordRepository recordRepository;
    private final IpoListingRepository ipoListingRepository;

    @Value("${app.public-base-url:https://db-world.in}")
    private String publicBaseUrl;

    /* ===============================
       RECORD DETAIL
       =============================== */

    @GetMapping(value = "/record/{type}/{id}", produces = MediaType.TEXT_HTML_VALUE)
    @Transactional(readOnly = true)
    public ResponseEntity<String> record(@PathVariable String type, @PathVariable Long id) {

        RecordEntity record = recordRepository.findByIdWithTmdb(id)
                .filter(r -> r.getVisibility() != null && r.getVisibility().isPublic())
                .orElse(null);

        if (record == null) {
            // 404 rather than a generic page: telling Google a DRAFT id is a real URL
            // would get it indexed as soft-404 filler.
            return ResponseEntity.status(404)
                    .contentType(MediaType.TEXT_HTML)
                    .body(page("Not found", "That title is not available.", null,
                            "<p>That title is not available.</p>", null));
        }

        TmdbEntity tmdb = record.getTmdb();
        String title = firstNonBlank(tmdb != null ? tmdb.getTitle() : null, record.getName(), "Untitled");
        String year = extractYear(tmdb != null ? tmdb.getPrimaryDate() : null);
        String overview = tmdb != null ? nullToEmpty(tmdb.getOverview()) : "";
        boolean isSeries = record.getType() == RecordType.TV_SERIES;
        String kind = isSeries ? "TV series" : "Movie";

        String heading = year != null ? title + " (" + year + ")" : title;
        String description = overview.isBlank()
                ? "Watch " + title + " on DB World."
                : truncate(overview, 155);

        List<String> genres = tmdb == null || tmdb.getGenres() == null ? List.of()
                : tmdb.getGenres().stream()
                    .map(g -> g.getName()).filter(Objects::nonNull).toList();

        List<String> cast = tmdb == null || tmdb.getCredits() == null ? List.of()
                : tmdb.getCredits().stream()
                    .filter(c -> c.getCreditType() == CreditType.CAST)
                    .sorted(Comparator.comparing(
                            (CreditEntity c) -> c.getCastOrder() == null ? Integer.MAX_VALUE : c.getCastOrder()))
                    .map(c -> c.getPerson() == null ? null : c.getPerson().getName())
                    .filter(Objects::nonNull)
                    .limit(CAST_LIMIT)
                    .toList();

        StringBuilder body = new StringBuilder();
        body.append("<h1>").append(esc(heading)).append("</h1>\n");

        // Facts line — the same strip of metadata the hero shows.
        StringBuilder facts = new StringBuilder(kind);
        if (year != null) facts.append(" &middot; ").append(year);
        if (tmdb != null && tmdb.getVoteAverage() > 0) {
            facts.append(" &middot; ").append(String.format("%.1f", tmdb.getVoteAverage())).append("/10");
        }
        if (tmdb != null && notBlank(tmdb.getCertification())) {
            facts.append(" &middot; ").append(esc(tmdb.getCertification()));
        }
        body.append("<p>").append(facts).append("</p>\n");

        if (notBlank(tmdb == null ? null : tmdb.getTagline())) {
            body.append("<p><em>").append(esc(tmdb.getTagline())).append("</em></p>\n");
        }
        if (!overview.isBlank()) {
            body.append("<h2>Synopsis</h2>\n<p>").append(esc(overview)).append("</p>\n");
        }
        if (!genres.isEmpty()) {
            body.append("<h2>Genres</h2>\n<p>").append(esc(String.join(", ", genres))).append("</p>\n");
        }
        if (!cast.isEmpty()) {
            body.append("<h2>Cast</h2>\n<ul>\n");
            cast.forEach(n -> body.append("  <li>").append(esc(n)).append("</li>\n"));
            body.append("</ul>\n");
        }

        String canonical = recordUrl(record, title);
        String image = image(tmdb);

        String jsonLd = """
                {"@context":"https://schema.org","@type":"%s","name":"%s","description":"%s","url":"%s"%s%s}"""
                .formatted(
                        isSeries ? "TVSeries" : "Movie",
                        jsonEsc(title),
                        jsonEsc(truncate(overview, 300)),
                        jsonEsc(canonical),
                        image == null ? "" : ",\"image\":\"" + jsonEsc(image) + "\"",
                        year == null ? "" : ",\"datePublished\":\"" + jsonEsc(year) + "\"");

        return html(page(heading, description, canonical, body.toString(), jsonLd));
    }

    /* ===============================
       IPO DETAIL
       =============================== */

    @GetMapping(value = "/ipo/{id}", produces = MediaType.TEXT_HTML_VALUE)
    @Transactional(readOnly = true)
    public ResponseEntity<String> ipo(@PathVariable String id) {

        IpoListingEntity ipo = ipoListingRepository.findById(id).orElse(null);
        if (ipo == null) {
            return ResponseEntity.status(404)
                    .contentType(MediaType.TEXT_HTML)
                    .body(page("Not found", "That IPO is not available.", null,
                            "<p>That IPO is not available.</p>", null));
        }

        String name = firstNonBlank(ipo.getCompanyName(), id);
        String heading = name + " IPO";
        String canonical = publicBaseUrl + "/db-world/db-ipo/" + urlSafe(id);

        StringBuilder body = new StringBuilder();
        body.append("<h1>").append(esc(heading)).append("</h1>\n");
        if (notBlank(ipo.getStatus())) {
            body.append("<p>Status: ").append(esc(ipo.getStatus()));
            if (notBlank(ipo.getIpoType())) body.append(" &middot; ").append(esc(ipo.getIpoType()));
            if (notBlank(ipo.getListingExchange())) body.append(" &middot; ").append(esc(ipo.getListingExchange()));
            body.append("</p>\n");
        }

        body.append("<h2>Key details</h2>\n<ul>\n");
        li(body, "Open date", ipo.getOpenDate());
        li(body, "Close date", ipo.getCloseDate());
        li(body, "Allotment date", ipo.getAllotmentDate());
        li(body, "Listing date", ipo.getListingDate());
        if (ipo.getPriceMin() != null && ipo.getPriceMax() != null) {
            li(body, "Price band", "Rs " + ipo.getPriceMin() + " to Rs " + ipo.getPriceMax());
        }
        li(body, "Lot size", ipo.getLotSize());
        li(body, "Issue size", ipo.getIssueSize());
        li(body, "GMP", ipo.getGmp());
        li(body, "Registrar", ipo.getRegistrar());
        body.append("</ul>\n");

        if (notBlank(ipo.getAbout())) {
            body.append("<h2>About ").append(esc(name)).append("</h2>\n<p>")
                .append(esc(ipo.getAbout())).append("</p>\n");
        }

        String description = "%s IPO — dates, price band, lot size, GMP and subscription status."
                .formatted(name);

        String jsonLd = """
                {"@context":"https://schema.org","@type":"Corporation","name":"%s","url":"%s"}"""
                .formatted(jsonEsc(name), jsonEsc(canonical));

        return html(page(heading, description, canonical, body.toString(), jsonLd));
    }

    /* ===============================
       INDEX PAGES
       =============================== */

    /**
     * Link hubs. The sitemap tells Google these URLs exist; these pages let it reach
     * them by following links, which is how PageRank actually flows to a detail page.
     */
    @GetMapping(value = {"/browse", "/movies", "/series"}, produces = MediaType.TEXT_HTML_VALUE)
    @Transactional(readOnly = true)
    public ResponseEntity<String> catalogIndex(HttpServletRequest request) {

        String path = request.getRequestURI();
        RecordType filter = path.endsWith("/movies") ? RecordType.MOVIE
                : path.endsWith("/series") ? RecordType.TV_SERIES
                : null;

        String heading = filter == RecordType.MOVIE ? "Movies"
                : filter == RecordType.TV_SERIES ? "TV Shows"
                : "Browse";
        String canonical = publicBaseUrl + "/db-world/db-cinema/"
                + (filter == RecordType.MOVIE ? "movie" : filter == RecordType.TV_SERIES ? "tv-shows" : "browse");

        List<RecordEntity> records = recordRepository.findAllWithTmdbAndTags().stream()
                .filter(r -> r.getVisibility() != null && r.getVisibility().isPublic())
                .filter(r -> filter == null || r.getType() == filter)
                .limit(INDEX_LIMIT)
                .toList();

        StringBuilder body = new StringBuilder();
        body.append("<h1>").append(esc(heading)).append(" on DB World</h1>\n<ul>\n");
        for (RecordEntity r : records) {
            String t = firstNonBlank(r.getTmdb() != null ? r.getTmdb().getTitle() : null, r.getName(), "Untitled");
            String y = extractYear(r.getTmdb() != null ? r.getTmdb().getPrimaryDate() : null);
            body.append("  <li><a href=\"").append(esc(recordUrl(r, t))).append("\">")
                .append(esc(t)).append(y == null ? "" : " (" + y + ")")
                .append("</a></li>\n");
        }
        body.append("</ul>\n");

        return html(page(heading + " on DB World",
                "Browse " + heading.toLowerCase() + " available on DB World.",
                canonical, body.toString(), null));
    }

    @GetMapping(value = "/ipo", produces = MediaType.TEXT_HTML_VALUE)
    @Transactional(readOnly = true)
    public ResponseEntity<String> ipoIndex() {

        StringBuilder body = new StringBuilder();
        body.append("<h1>IPO Radar</h1>\n")
            .append("<p>Live mainboard and SME IPOs with dates, price bands, lot sizes and GMP.</p>\n<ul>\n");

        ipoListingRepository.findAll().stream()
                .filter(i -> i.getId() != null && !i.getId().isBlank())
                .limit(INDEX_LIMIT)
                .forEach(i -> body.append("  <li><a href=\"")
                        .append(esc(publicBaseUrl + "/db-world/db-ipo/" + urlSafe(i.getId())))
                        .append("\">").append(esc(firstNonBlank(i.getCompanyName(), i.getId())))
                        .append(" IPO</a></li>\n"));

        body.append("</ul>\n");

        return html(page("IPO Radar — live IPO dates, price band and GMP",
                "Track live mainboard and SME IPOs: open and close dates, price band, lot size, GMP and subscription status.",
                publicBaseUrl + "/db-world/db-ipo", body.toString(), null));
    }

    /* ===============================
       HELPERS
       =============================== */

    private ResponseEntity<String> html(String body) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .contentType(MediaType.TEXT_HTML)
                .body(body);
    }

    /**
     * The document shell.
     *
     * <p>Note there is deliberately NO meta refresh, unlike the social preview: a
     * crawler follows one and treats the page as a redirect, so the content would never
     * be indexed. The canonical link is what points at the SPA URL instead.
     */
    private String page(String title, String description, String canonical, String body, String jsonLd) {
        return """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <title>%s — DB World</title>
                <meta name="description" content="%s">
                %s<meta property="og:title" content="%s">
                <meta property="og:description" content="%s">
                <meta property="og:site_name" content="DB World">
                %s</head>
                <body>
                %s<p><a href="%s">DB World</a></p>
                </body>
                </html>
                """.formatted(
                esc(title),
                esc(description),
                canonical == null ? "" : "<link rel=\"canonical\" href=\"" + esc(canonical) + "\">\n",
                esc(title),
                esc(description),
                jsonLd == null ? "" : "<script type=\"application/ld+json\">" + jsonLd + "</script>\n",
                body,
                esc(publicBaseUrl + "/db-world/db-cinema/browse"));
    }

    private void li(StringBuilder sb, String label, Object value) {
        if (value == null || String.valueOf(value).isBlank()) return;
        sb.append("  <li>").append(esc(label)).append(": ").append(esc(String.valueOf(value))).append("</li>\n");
    }

    private String recordUrl(RecordEntity record, String title) {
        String segment = record.getType() == RecordType.TV_SERIES ? "series" : "movie";
        String slug = slugify(title);
        String param = slug.isEmpty() ? String.valueOf(record.getId()) : record.getId() + "-" + slug;
        return publicBaseUrl + "/db-world/db-cinema/" + segment + "/" + param;
    }

    private String image(TmdbEntity tmdb) {
        if (tmdb == null) return null;
        if (notBlank(tmdb.getPosterPath()))   return TMDB_IMG + "w500" + tmdb.getPosterPath();
        if (notBlank(tmdb.getBackdropPath())) return TMDB_IMG + "w1280" + tmdb.getBackdropPath();
        return null;
    }

    private String slugify(String raw) {
        if (raw == null || raw.isBlank()) return "";
        return EDGE_DASH.matcher(NON_ALNUM.matcher(raw.toLowerCase()).replaceAll("-")).replaceAll("");
    }

    /** Path segment safety for ids that came from a scraped source. */
    private String urlSafe(String raw) {
        return raw == null ? "" : raw.replace("\"", "").replace("<", "").replace(">", "").trim();
    }

    private String extractYear(String dateStr) {
        return (dateStr != null && dateStr.length() >= 4) ? dateStr.substring(0, 4) : null;
    }

    private String truncate(String s, int max) {
        if (s == null) return "";
        String flat = s.replaceAll("\\s+", " ").trim();
        return flat.length() <= max ? flat : flat.substring(0, max).trim() + "…";
    }

    private static String firstNonBlank(String... vals) {
        for (String v : vals) if (notBlank(v)) return v;
        return "";
    }

    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }

    private static String nullToEmpty(String s) { return s == null ? "" : s; }

    private static String esc(String s) { return HtmlUtils.htmlEscape(nullToEmpty(s)); }

    /** JSON-LD sits inside a script block, so it needs JSON escaping, not HTML escaping. */
    private static String jsonEsc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", " ")
                .replace("\r", " ")
                .replace("<", "\\u003C");
    }
}
