package com.db.dbworld.app.content;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.log4j.Log4j2;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;

/**
 * Loads the shared editorial copy and renders it as crawler HTML.
 *
 * <p>Read once at startup: the file ships inside the WAR, so it cannot change without a
 * redeploy and re-reading it per request would only add I/O to every crawl.
 *
 * <p>A missing or malformed file is logged and degrades to "no editorial copy" rather
 * than failing the context. The prose is important, but it is not worth refusing to
 * start the application over — every other endpoint would go down with it.
 */
@Service
@Log4j2
public class SiteContentService {

    private static final String RESOURCE = "site-content.json";

    private final Map<String, SiteContent.Page> pages;

    public SiteContentService(ObjectMapper objectMapper) {
        this.pages = load(objectMapper);
    }

    private static Map<String, SiteContent.Page> load(ObjectMapper objectMapper) {
        try (InputStream in = new ClassPathResource(RESOURCE).getInputStream()) {
            // Explicit UTF-8: the copy contains typographic punctuation, and the JVM
            // default charset on the deploy host is not guaranteed to be UTF-8.
            String json = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            SiteContent content = objectMapper.readValue(json, SiteContent.class);

            Map<String, SiteContent.Page> loaded =
                    content.pages() == null ? Map.of() : content.pages();
            log.info("Loaded editorial copy for {} public page(s) from {}", loaded.size(), RESOURCE);
            return loaded;

        } catch (IOException | RuntimeException e) {
            log.error("Could not load {} — public pages will render without editorial copy. "
                    + "Crawlers will see thin pages until this is fixed.", RESOURCE, e);
            return Map.of();
        }
    }

    /** Copy for one page key, empty when there is none. */
    public Optional<SiteContent.Page> page(String key) {
        return Optional.ofNullable(pages.get(key));
    }

    /**
     * One page's sections as HTML, for embedding in a crawler document.
     *
     * <p>Mirrors {@code EditorialSections.jsx} element for element — {@code h2} per
     * section, {@code p} per paragraph, {@code dl}/{@code dt}/{@code dd} for a term
     * list — so what a crawler parses and what a visitor reads are the same document
     * structure, not just the same words.
     *
     * @return the markup, or an empty string when the key has no copy
     */
    public String sectionsHtml(String key) {
        return page(key).map(SiteContentService::renderSections).orElse("");
    }

    /** The lead paragraph as HTML, or an empty string. */
    public String leadHtml(String key) {
        return page(key)
                .map(SiteContent.Page::lead)
                .filter(lead -> !lead.isBlank())
                .map(lead -> "<p>" + esc(lead) + "</p>\n")
                .orElse("");
    }

    /**
     * Lead plus sections — the whole editorial block, in the order
     * {@code EditorialSections.jsx} renders it.
     *
     * <p>This is the one to call from a crawler page. Reaching for {@link #leadHtml} or
     * {@link #sectionsHtml} alone gives the crawler a subset of what the visitor reads,
     * which is the difference this whole arrangement exists to avoid.
     */
    public String editorialHtml(String key) {
        return leadHtml(key) + sectionsHtml(key);
    }

    private static String renderSections(SiteContent.Page page) {
        StringBuilder html = new StringBuilder();

        for (SiteContent.Section section : page.sectionsOrEmpty()) {
            if (section.heading() != null && !section.heading().isBlank()) {
                html.append("<h2>").append(esc(section.heading())).append("</h2>\n");
            }

            section.paragraphsOrEmpty().stream()
                    .filter(p -> p != null && !p.isBlank())
                    .forEach(p -> html.append("<p>").append(esc(p)).append("</p>\n"));

            if (!section.listOrEmpty().isEmpty()) {
                html.append("<dl>\n");
                for (SiteContent.Term term : section.listOrEmpty()) {
                    html.append("  <dt>").append(esc(term.term())).append("</dt>\n")
                        .append("  <dd>").append(esc(term.text())).append("</dd>\n");
                }
                html.append("</dl>\n");
            }
        }

        return html.toString();
    }

    private static String esc(String s) {
        return HtmlUtils.htmlEscape(s == null ? "" : s);
    }
}
