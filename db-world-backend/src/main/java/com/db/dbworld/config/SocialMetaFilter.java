package com.db.dbworld.config;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import jakarta.annotation.Nonnull;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.HtmlUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Injects record-specific Open Graph / Twitter Card meta tags into index.html
 * for known social crawler bots before they see the page.
 *
 * When WhatsApp, Slack, Twitter etc. crawl a shared record URL, they send an
 * HTTP GET but never execute JavaScript — so React's useEffect meta-tag writes
 * are invisible to them. They see the static index.html with only the generic
 * <title>DB World :)</title>. This filter intercepts those bot requests,
 * fetches the record from the database, and returns a patched HTML response
 * containing the correct title, description, and preview image.
 *
 * All other requests (real browsers, API calls) pass through unchanged.
 */
@Component
@Log4j2
@RequiredArgsConstructor
public class SocialMetaFilter extends OncePerRequestFilter {

    private static final Set<String> CRAWLERS = Set.of(
            "whatsapp", "slackbot", "twitterbot", "facebookexternalhit",
            "telegrambot", "linkedinbot", "discordbot", "applebot",
            "googlebot", "bingbot", "ia_archiver"
    );

    // Route: /db-world/cinema/movie/123-some-slug  or  /db-world/cinema/series/123
    // The record ID is always the leading digits of the :title param segment.
    private static final Pattern RECORD_PATH =
            Pattern.compile(".*/cinema/(movie|series)/(\\d+).*", Pattern.CASE_INSENSITIVE);

    private static final String TMDB_IMG = "https://image.tmdb.org/t/p/";

    // ObjectProvider defers the JPA repository lookup until first request,
    // avoiding a circular startup-ordering failure where the filter bean is
    // instantiated before JPA's EntityManager is ready.
    private final ObjectProvider<RecordRepository> recordRepositoryProvider;

    @Override
    protected boolean shouldNotFilter(@Nonnull HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/api/")
                || path.startsWith("/actuator/")
                || path.startsWith("/ws/")
                || path.startsWith("/swagger-ui/")
                || path.startsWith("/v3/");
    }

    @Override
    protected void doFilterInternal(@Nonnull HttpServletRequest request,
                                    @Nonnull HttpServletResponse response,
                                    @Nonnull FilterChain chain)
            throws ServletException, IOException {

        if (!isCrawler(request.getHeader("User-Agent"))) {
            chain.doFilter(request, response);
            return;
        }

        Matcher m = RECORD_PATH.matcher(request.getRequestURI());
        if (!m.matches()) {
            chain.doFilter(request, response);
            return;
        }

        long recordId;
        try {
            recordId = Long.parseLong(m.group(2));
        } catch (NumberFormatException e) {
            chain.doFilter(request, response);
            return;
        }

        String html = readIndexHtml();
        Optional<RecordEntity> recordOpt = recordRepositoryProvider.getObject().findByIdWithTmdb(recordId);
        if (recordOpt.isPresent()) {
            html = injectMeta(html, recordOpt.get());
            log.debug("Social meta injected for record {} ({})", recordId, request.getHeader("User-Agent"));
        }

        response.setContentType("text/html;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(html);
    }

    private String injectMeta(String html, RecordEntity record) {
        TmdbEntity tmdb = record.getTmdb();
        if (tmdb == null) return html;

        String rawTitle = tmdb.getTitle() != null ? tmdb.getTitle() : record.getName();
        String year     = extractYear(tmdb.getPrimaryDate());
        String display  = year != null ? rawTitle + " (" + year + ")" : rawTitle;

        String safeTitle = HtmlUtils.htmlEscape(display);
        String safeDesc  = (tmdb.getOverview() != null && !tmdb.getOverview().isBlank())
                ? HtmlUtils.htmlEscape(tmdb.getOverview()) : safeTitle;
        String image  = resolveImage(tmdb);
        String ogType = "TV_SERIES".equals(record.getType().name()) ? "video.tv_show" : "video.movie";

        String tags = """
                <title>%s — DB Cinema</title>
                <meta property="og:title"       content="%s" />
                <meta property="og:description" content="%s" />
                <meta property="og:image"       content="%s" />
                <meta property="og:type"        content="%s" />
                <meta name="twitter:card"        content="summary_large_image" />
                <meta name="twitter:title"       content="%s" />
                <meta name="twitter:description" content="%s" />
                <meta name="twitter:image"       content="%s" />
                """.formatted(safeTitle, safeTitle, safeDesc, image, ogType,
                              safeTitle, safeDesc, image);

        return html.replace("<title>DB World :)</title>", tags);
    }

    private String readIndexHtml() throws IOException {
        return new ClassPathResource("public/index.html")
                .getContentAsString(StandardCharsets.UTF_8);
    }

    private String extractYear(String dateStr) {
        return (dateStr != null && dateStr.length() >= 4) ? dateStr.substring(0, 4) : null;
    }

    private String resolveImage(TmdbEntity tmdb) {
        if (tmdb.getBackdropPath() != null && !tmdb.getBackdropPath().isBlank())
            return TMDB_IMG + "w1280" + tmdb.getBackdropPath();
        if (tmdb.getPosterPath() != null && !tmdb.getPosterPath().isBlank())
            return TMDB_IMG + "w500" + tmdb.getPosterPath();
        return "";
    }

    private boolean isCrawler(String ua) {
        if (ua == null) return false;
        String lower = ua.toLowerCase();
        return CRAWLERS.stream().anyMatch(lower::contains);
    }
}
