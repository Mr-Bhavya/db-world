package com.db.dbworld.app.content;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;
import java.util.Map;

/**
 * The shape of {@code site-content.json} — the public site's editorial copy.
 *
 * <p>That file is the single source of truth for this prose and is read by BOTH sides:
 * the SPA imports it through the Vite alias {@code @content}, and
 * {@link com.db.dbworld.app.cinema.social.SeoRenderController} renders it here for
 * crawlers. Keeping one copy is what makes dynamic rendering legitimate — the crawler
 * sees the same words as the visitor, just earlier. Two copies would drift inside a
 * release and turn it into cloaking.
 *
 * <p>Unknown properties are ignored so the JSON can carry {@code _comment} blocks (and
 * later gain fields the backend does not render) without breaking startup.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SiteContent(Map<String, Page> pages) {

    /** One public page's copy. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Page(
            String h1,
            String title,
            String description,
            String lead,
            List<Section> sections) {

        public List<Section> sectionsOrEmpty() {
            return sections == null ? List.of() : sections;
        }
    }

    /**
     * A run of prose or a term/definition list.
     *
     * <p>Exactly one of {@code paragraphs} / {@code list} is populated. Both renderers
     * — this one and {@code EditorialSections.jsx} — handle those two shapes and only
     * those; a third shape has to be taught to both or the two sides stop matching.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Section(String heading, List<String> paragraphs, List<Term> list) {

        public List<String> paragraphsOrEmpty() {
            return paragraphs == null ? List.of() : paragraphs;
        }

        public List<Term> listOrEmpty() {
            return list == null ? List.of() : list;
        }
    }

    /** A term and its definition, rendered as a {@code <dl>} pair on both sides. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Term(String term, String text) {}
}
