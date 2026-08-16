package com.db.dbworld.app.cinema.social;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
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
import java.util.regex.Pattern;

/**
 * Server-rendered Open Graph / Twitter Card previews for shared cinema records.
 *
 * <p><b>Why this exists.</b> {@code db-world.in} is served by nginx as static files
 * (root {@code /var/www/dbworld/current}); Spring Boot lives on {@code api.db-world.in}.
 * Social crawlers (WhatsApp, Slack, Twitter…) issue a plain GET and never execute
 * JavaScript, so the meta tags {@code RecordDetailContent} writes in a {@code useEffect}
 * are invisible to them — they only ever saw the static {@code index.html} and its
 * generic {@code <title>DB World :)</title>}.
 *
 * <p>nginx matches a crawler User-Agent on a record path and proxies it here (see
 * {@code 10-app.conf} in the db-world-config repo). This endpoint returns a small,
 * self-contained HTML document: crawlers only ever read {@code <head>}, so there is no
 * need to reproduce — or stay in sync with — the real SPA shell. A human who somehow
 * lands here is bounced to the canonical URL by the meta refresh.
 *
 * <p><b>DRAFT records are never disclosed.</b> A DRAFT id and a nonexistent id return
 * byte-identical generic site cards, so a shared link cannot be used to probe for
 * unpublished titles.
 */
@RestController
@RequestMapping("/api/social")
@Log4j2
@RequiredArgsConstructor
public class SocialPreviewController {

    private static final String TMDB_IMG = "https://image.tmdb.org/t/p/";

    /** Mirrors the frontend slug rules in {@code recordNav.js#recordDetailPath}. */
    private static final Pattern NON_ALNUM = Pattern.compile("[^a-z0-9]+");
    private static final Pattern EDGE_DASH = Pattern.compile("^-+|-+$");

    private static final String SITE_NAME = "DB World";
    private static final String SITE_DESC =
            "Stream, download and manage movies and TV shows on DB World.";

    private final RecordRepository recordRepository;

    /** Public origin the canonical/redirect URLs are built from (no trailing slash). */
    @Value("${app.public-base-url:https://db-world.in}")
    private String publicBaseUrl;

    /**
     * Fallback preview image, resolved against {@link #publicBaseUrl} when relative.
     * PNG on purpose — the 512px site icon is WebP, which several crawlers (WhatsApp
     * among them) will not render as a preview thumbnail.
     */
    @Value("${app.social.fallback-image:/icons/icon-192.png}")
    private String fallbackImage;

    @GetMapping(value = "/record/{type}/{id}", produces = MediaType.TEXT_HTML_VALUE)
    @Transactional(readOnly = true)
    public ResponseEntity<String> recordPreview(@PathVariable String type, @PathVariable Long id) {

        RecordEntity record = recordRepository.findByIdWithTmdb(id)
                .filter(r -> r.getVisibility() != null && r.getVisibility().isPublic())
                .orElse(null);

        String html = (record == null) ? genericCard() : recordCard(record);

        if (record == null) {
            // Deliberately indistinguishable from "not found" — see class javadoc.
            log.debug("Social preview: no public record for type={} id={}", type, id);
        }

        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                // Crawlers re-fetch on every share; a short cache keeps the DB hit off the
                // hot path without pinning stale artwork after a TMDB re-sync.
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(10)).cachePublic())
                .body(html);
    }

    /* ===============================
       CARD BUILDERS
       =============================== */

    private String recordCard(RecordEntity record) {
        TmdbEntity tmdb = record.getTmdb();

        String rawTitle = (tmdb != null && tmdb.getTitle() != null && !tmdb.getTitle().isBlank())
                ? tmdb.getTitle()
                : record.getName();
        String year = (tmdb != null) ? extractYear(tmdb.getPrimaryDate()) : null;
        String display = (year != null) ? rawTitle + " (" + year + ")" : rawTitle;

        String overview = (tmdb != null && tmdb.getOverview() != null && !tmdb.getOverview().isBlank())
                ? tmdb.getOverview()
                : SITE_DESC;

        boolean isSeries = record.getType() == RecordType.TV_SERIES;

        return renderCard(
                display,
                overview,
                resolveImage(tmdb),
                isSeries ? "video.tv_show" : "video.movie",
                canonicalUrl(record, rawTitle)
        );
    }

    /** Site-level card for unknown/DRAFT ids — never reveals which of the two it was. */
    private String genericCard() {
        return renderCard(SITE_NAME, SITE_DESC, absolute(fallbackImage), "website", publicBaseUrl);
    }

    private String renderCard(String title, String description, String image,
                              String ogType, String canonical) {

        String t = HtmlUtils.htmlEscape(title);
        String d = HtmlUtils.htmlEscape(description);
        String i = HtmlUtils.htmlEscape(image);
        String u = HtmlUtils.htmlEscape(canonical);

        return """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                <meta charset="utf-8" />
                <title>%s — %s</title>
                <link rel="canonical" href="%s" />
                <meta property="og:site_name"   content="%s" />
                <meta property="og:title"       content="%s" />
                <meta property="og:description" content="%s" />
                <meta property="og:image"       content="%s" />
                <meta property="og:type"        content="%s" />
                <meta property="og:url"         content="%s" />
                <meta name="twitter:card"        content="summary_large_image" />
                <meta name="twitter:title"       content="%s" />
                <meta name="twitter:description" content="%s" />
                <meta name="twitter:image"       content="%s" />
                <meta http-equiv="refresh" content="0; url=%s" />
                </head>
                <body><p><a href="%s">%s</a></p></body>
                </html>
                """.formatted(t, SITE_NAME, u, SITE_NAME, t, d, i, ogType, u, t, d, i, u, u, t);
    }

    /* ===============================
       HELPERS
       =============================== */

    /**
     * Rebuilds the SPA detail URL. Only the leading id is meaningful on read — the
     * frontend does {@code title.split('-')[0]} — so the slug is purely cosmetic.
     */
    private String canonicalUrl(RecordEntity record, String title) {
        String segment = record.getType() == RecordType.TV_SERIES ? "series" : "movie";
        String slug = slugify(title);
        String param = slug.isEmpty() ? String.valueOf(record.getId()) : record.getId() + "-" + slug;
        return publicBaseUrl + "/db-world/db-cinema/" + segment + "/" + param;
    }

    private String slugify(String raw) {
        if (raw == null || raw.isBlank()) return "";
        String lower = raw.toLowerCase();
        return EDGE_DASH.matcher(NON_ALNUM.matcher(lower).replaceAll("-")).replaceAll("");
    }

    private String extractYear(String dateStr) {
        return (dateStr != null && dateStr.length() >= 4) ? dateStr.substring(0, 4) : null;
    }

    private String resolveImage(TmdbEntity tmdb) {
        if (tmdb != null) {
            if (tmdb.getBackdropPath() != null && !tmdb.getBackdropPath().isBlank())
                return TMDB_IMG + "w1280" + tmdb.getBackdropPath();
            if (tmdb.getPosterPath() != null && !tmdb.getPosterPath().isBlank())
                return TMDB_IMG + "w500" + tmdb.getPosterPath();
        }
        return absolute(fallbackImage);
    }

    /** Crawlers reject relative og:image values, so site-local paths are made absolute. */
    private String absolute(String path) {
        if (path == null || path.isBlank()) return "";
        return path.startsWith("http") ? path : publicBaseUrl + path;
    }
}
