package com.db.dbworld.app.cinema.social;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.regex.Pattern;

/**
 * XML sitemap for the public browse surface.
 *
 * <p><b>Why it is served here and not as a static file.</b> {@code db-world.in} is nginx
 * serving a built SPA, so a file baked at build time would list only the records that
 * existed at the last deploy — and the IPO list changes several times a day. This
 * endpoint reads the same tables the pages do, so the sitemap is never stale.
 *
 * <p>nginx must map the public path onto it, alongside the existing social-preview
 * proxy in {@code 10-app.conf} (db-world-config repo):
 * <pre>
 * location = /sitemap.xml {
 *     proxy_pass https://api.db-world.in/sitemap.xml;
 *     proxy_set_header Host api.db-world.in;
 * }
 * </pre>
 *
 * <p>Only records a visitor can actually open are listed. {@code DRAFT} is excluded —
 * publishing a sitemap of unreleased titles would leak exactly what
 * {@link SocialPreviewController} is careful not to.
 */
@RestController
@Log4j2
@RequiredArgsConstructor
public class SitemapController {

    /** Mirrors {@code recordNav.js#recordDetailPath} and SocialPreviewController. */
    private static final Pattern NON_ALNUM = Pattern.compile("[^a-z0-9]+");
    private static final Pattern EDGE_DASH = Pattern.compile("^-+|-+$");

    private static final DateTimeFormatter W3C_DATE =
            DateTimeFormatter.ISO_LOCAL_DATE.withZone(ZoneOffset.UTC);

    private final RecordRepository recordRepository;
    private final IpoListingRepository ipoListingRepository;

    @Value("${app.public-base-url:https://db-world.in}")
    private String publicBaseUrl;

    @GetMapping(value = "/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    @Transactional(readOnly = true)
    public ResponseEntity<String> sitemap() {

        StringBuilder xml = new StringBuilder(1 << 16);
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
           .append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

        // Landing pages, most important first.
        url(xml, publicBaseUrl + "/db-world/db-cinema/browse",    null, "daily",  "1.0");
        url(xml, publicBaseUrl + "/db-world/db-cinema/movie",     null, "daily",  "0.9");
        url(xml, publicBaseUrl + "/db-world/db-cinema/tv-shows",  null, "daily",  "0.9");
        url(xml, publicBaseUrl + "/db-world/ipo",                 null, "hourly", "1.0");

        int records = 0;
        for (RecordEntity record : recordRepository.findAllWithTmdbAndTags()) {
            if (record.getVisibility() == null || !record.getVisibility().isPublic()) continue;
            url(xml, canonicalUrl(record), null, "weekly", "0.8");
            records++;
        }

        int ipos = 0;
        for (var ipo : ipoListingRepository.findAll()) {
            if (ipo.getId() == null || ipo.getId().isBlank()) continue;
            url(xml,
                publicBaseUrl + "/db-world/ipo/" + ipo.getId(),
                ipo.getUpdatedAt(),
                // An open IPO's GMP and subscription numbers move through the day; a
                // closed one is effectively frozen.
                "daily",
                "0.7");
            ipos++;
        }

        xml.append("</urlset>\n");
        log.debug("sitemap: {} records, {} IPOs", records, ipos);

        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .contentType(MediaType.APPLICATION_XML)
                .body(xml.toString());
    }

    /* ===============================
       HELPERS
       =============================== */

    private void url(StringBuilder xml, String loc, Instant lastMod, String changeFreq, String priority) {
        xml.append("  <url>\n")
           .append("    <loc>").append(HtmlUtils.htmlEscape(loc)).append("</loc>\n");
        if (lastMod != null) {
            xml.append("    <lastmod>").append(W3C_DATE.format(lastMod)).append("</lastmod>\n");
        }
        xml.append("    <changefreq>").append(changeFreq).append("</changefreq>\n")
           .append("    <priority>").append(priority).append("</priority>\n")
           .append("  </url>\n");
    }

    private String canonicalUrl(RecordEntity record) {
        String segment = record.getType() == RecordType.TV_SERIES ? "series" : "movie";
        String title = record.getTmdb() != null && record.getTmdb().getTitle() != null
                ? record.getTmdb().getTitle()
                : record.getName();
        String slug = slugify(title);
        String param = slug.isEmpty() ? String.valueOf(record.getId()) : record.getId() + "-" + slug;
        return publicBaseUrl + "/db-world/db-cinema/" + segment + "/" + param;
    }

    private String slugify(String raw) {
        if (raw == null || raw.isBlank()) return "";
        return EDGE_DASH.matcher(NON_ALNUM.matcher(raw.toLowerCase()).replaceAll("-")).replaceAll("");
    }
}
