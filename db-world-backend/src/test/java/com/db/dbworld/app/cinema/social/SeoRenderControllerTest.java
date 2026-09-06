package com.db.dbworld.app.cinema.social;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.enums.RecordVisibility;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.app.content.SiteContentService;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SeoRenderControllerTest {

    private static final String BASE = "https://db-world.in";

    @Mock RecordRepository recordRepository;
    @Mock IpoListingRepository ipoListingRepository;

    SeoRenderController controller;

    @BeforeEach
    void setUp() {
        // A REAL SiteContentService, not a mock: it reads the actual site-content.json
        // off the test classpath, so these tests also prove the shipped copy parses and
        // renders. A mock would let a malformed content file through to production —
        // and the content file is the whole point of the change these tests cover.
        var siteContent = new SiteContentService();

        controller = new SeoRenderController(recordRepository, ipoListingRepository, siteContent);
        ReflectionTestUtils.setField(controller, "publicBaseUrl", BASE);
    }

    /* ===============================
       HELPERS
       =============================== */

    private TmdbEntity tmdb(String title, String overview) {
        TmdbEntity t = new TmdbEntity();
        t.setTitle(title);
        t.setOverview(overview);
        t.setPrimaryDate("2010-07-16");
        t.setPosterPath("/poster.jpg");
        t.setVoteAverage(8.4);
        return t;
    }

    private RecordEntity record(long id, String name, RecordType type, RecordVisibility vis, TmdbEntity t) {
        return RecordEntity.builder().id(id).name(name).type(type).visibility(vis).tmdb(t).build();
    }

    /* ===============================
       RECORD RENDERING
       =============================== */

    @Test
    void rendersRealBodyContentNotJustMetaTags() {
        when(recordRepository.findByIdWithTmdb(123L)).thenReturn(Optional.of(
                record(123L, "Inception", RecordType.MOVIE, RecordVisibility.PUBLISHED,
                        tmdb("Inception", "A thief who steals corporate secrets."))));

        String html = controller.record("movie", 123L).getBody();

        assertThat(html)
                .contains("<h1>Inception (2010)</h1>")
                .contains("<h2>Synopsis</h2>")
                .contains("A thief who steals corporate secrets.")
                .contains("8.4/10");
    }

    /**
     * The whole reason this controller exists separately from SocialPreviewController:
     * a crawler follows a meta refresh and indexes the page as a redirect, so the
     * content never lands. If this assertion ever fails, indexing is silently broken.
     */
    @Test
    void hasNoMetaRefresh_thatWouldReadAsARedirectToACrawler() {
        when(recordRepository.findByIdWithTmdb(123L)).thenReturn(Optional.of(
                record(123L, "Inception", RecordType.MOVIE, RecordVisibility.PUBLISHED,
                        tmdb("Inception", "Synopsis here."))));

        assertThat(controller.record("movie", 123L).getBody())
                .doesNotContain("http-equiv=\"refresh\"")
                .doesNotContain("http-equiv='refresh'");
    }

    @Test
    void pointsCanonicalAtTheSpaUrl() {
        when(recordRepository.findByIdWithTmdb(123L)).thenReturn(Optional.of(
                record(123L, "Inception", RecordType.MOVIE, RecordVisibility.PUBLISHED,
                        tmdb("Inception", "Synopsis here."))));

        assertThat(controller.record("movie", 123L).getBody())
                .contains("<link rel=\"canonical\" href=\"https://db-world.in/db-cinema/movie/123-inception\">");
    }

    @Test
    void emitsMovieStructuredData() {
        when(recordRepository.findByIdWithTmdb(123L)).thenReturn(Optional.of(
                record(123L, "Inception", RecordType.MOVIE, RecordVisibility.PUBLISHED,
                        tmdb("Inception", "Synopsis here."))));

        assertThat(controller.record("movie", 123L).getBody())
                .contains("application/ld+json")
                .contains("\"@type\":\"Movie\"")
                .contains("\"name\":\"Inception\"");
    }

    @Test
    void seriesGetsTvSeriesTypeAndSeriesUrlSegment() {
        when(recordRepository.findByIdWithTmdb(456L)).thenReturn(Optional.of(
                record(456L, "Breaking Bad", RecordType.TV_SERIES, RecordVisibility.PUBLISHED,
                        tmdb("Breaking Bad", "A chemistry teacher."))));

        assertThat(controller.record("series", 456L).getBody())
                .contains("\"@type\":\"TVSeries\"")
                .contains("/db-cinema/series/456-breaking-bad");
    }

    /* ===============================
       DISCLOSURE
       =============================== */

    @Test
    void draftRecordIs404AndLeaksNothing() {
        when(recordRepository.findByIdWithTmdb(999L)).thenReturn(Optional.of(
                record(999L, "Unreleased Thing", RecordType.MOVIE, RecordVisibility.DRAFT,
                        tmdb("Unreleased Thing", "Secret synopsis."))));

        var response = controller.record("movie", 999L);

        assertThat(response.getStatusCode().value()).isEqualTo(404);
        assertThat(response.getBody())
                .doesNotContain("Unreleased Thing")
                .doesNotContain("Secret synopsis");
    }

    @Test
    void missingRecordIs404() {
        when(recordRepository.findByIdWithTmdb(1L)).thenReturn(Optional.empty());
        assertThat(controller.record("movie", 1L).getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void catalogIndexOmitsDraftRecords() {
        when(recordRepository.findAllWithTmdbAndTags()).thenReturn(List.of(
                record(1L, "Public One", RecordType.MOVIE, RecordVisibility.PUBLISHED, tmdb("Public One", "x")),
                record(2L, "Hidden One", RecordType.MOVIE, RecordVisibility.DRAFT, tmdb("Hidden One", "x"))));

        var req = new org.springframework.mock.web.MockHttpServletRequest("GET", "/api/seo/browse");
        String html = controller.catalogIndex(req).getBody();

        assertThat(html).contains("Public One").doesNotContain("Hidden One");
    }

    /* ===============================
       ESCAPING
       =============================== */

    @Test
    void titleWithMarkupIsEscapedInBodyAndJsonLd() {
        when(recordRepository.findByIdWithTmdb(7L)).thenReturn(Optional.of(
                record(7L, "x", RecordType.MOVIE, RecordVisibility.PUBLISHED,
                        tmdb("<script>alert(1)</script>", "\"quoted\" synopsis"))));

        String html = controller.record("movie", 7L).getBody();

        assertThat(html).doesNotContain("<script>alert(1)</script>");
        // The JSON-LD block must not be closable by injected markup either.
        assertThat(html).contains("\\u003C");
    }

    /* ===============================
       IPO
       =============================== */

    @Test
    void rendersIpoDetail() {
        IpoListingEntity ipo = new IpoListingEntity();
        ipo.setId("acme-industries");
        ipo.setCompanyName("Acme Industries");
        ipo.setStatus("OPEN");
        ipo.setLotSize(75);
        when(ipoListingRepository.findById("acme-industries")).thenReturn(Optional.of(ipo));

        String html = controller.ipo("acme-industries").getBody();

        assertThat(html)
                .contains("<h1>Acme Industries IPO</h1>")
                .contains("Lot size: 75")
                .contains("<link rel=\"canonical\" href=\"https://db-world.in/db-ipo/acme-industries\">");
    }

    @Test
    void missingIpoIs404() {
        when(ipoListingRepository.findById("nope")).thenReturn(Optional.empty());
        assertThat(controller.ipo("nope").getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void ipoIndexLinksEachListing() {
        IpoListingEntity ipo = new IpoListingEntity();
        ipo.setId("acme-industries");
        ipo.setCompanyName("Acme Industries");
        when(ipoListingRepository.findAll()).thenReturn(List.of(ipo));

        assertThat(controller.ipoIndex().getBody())
                .contains("href=\"https://db-world.in/db-ipo/acme-industries\"")
                .contains("Acme Industries IPO");
    }

    /* ===============================
       ADSENSE REMEDIATION (September 2026)

       Google rejected the site for "low value content" and for serving ads on screens
       with no publisher content. These lock in the three things that fixed it, because
       every one of them is easy to undo by accident.
       =============================== */

    @Test
    void recordPagesAreNoindexButStillFollowed() {
        TmdbEntity t = tmdb("Inception", "A thief who steals corporate secrets.");
        when(recordRepository.findByIdWithTmdb(1L))
                .thenReturn(Optional.of(record(1L, "Inception", RecordType.MOVIE, RecordVisibility.PUBLISHED, t)));

        // Every word on a record page comes from TMDB. ~2,300 of them were 89% of the
        // sitemap and the clearest reason Google called the site low value.
        // `follow` matters as much as `noindex`: the links out still have to count.
        assertThat(controller.record("movie", 1L).getBody())
                .contains("<meta name=\"robots\" content=\"noindex,follow\">");
    }

    @Test
    void catalogIndexCarriesTheEditorialCopy() {
        when(recordRepository.findAllWithTmdbAndTags()).thenReturn(List.of());

        // Without this the browse page is a bare list of film titles — which is exactly
        // what Google assessed. The copy must come through even with an empty catalogue.
        var req = new org.springframework.mock.web.MockHttpServletRequest("GET", "/api/seo/browse");
        assertThat(controller.catalogIndex(req).getBody())
                .contains("How the catalogue is organised")
                .contains("<dt>HDR</dt>");
    }

    @Test
    void ipoIndexCarriesTheFaqAndGlossary() {
        when(ipoListingRepository.findAll()).thenReturn(List.of());

        // The FAQ and the 24-term glossary are the best-written content on the site and
        // a crawler could not see a word of them: this page used to be company names.
        assertThat(controller.ipoIndex().getBody())
                .contains("Common questions about IPOs")
                .contains("What is GMP (Grey Market Premium)?")
                .contains("IPO terms explained")
                .contains("<dt>ASBA</dt>");
    }

    @Test
    void editorialPagesRenderRealContent() {
        // These four served the crawler a 5 KB SPA shell with zero words, while sitting
        // in robots.txt and the sitemap the whole time.
        for (String key : List.of("home", "weather", "games", "about")) {
            String html = controller.editorialPage(key).getBody();

            assertThat(html)
                    .as("editorial page: %s", key)
                    .contains("<h1>")
                    .contains("<h2>")
                    .contains("<link rel=\"canonical\"");

            // The generic shell appends " — DB World"; these titles are authored whole
            // and already carry the brand, so it must not be appended twice.
            assertThat(html)
                    .as("brand is not doubled in the title of: %s", key)
                    .doesNotContain("— DB World</title>");
        }
    }

    @Test
    void editorialPagesRenderEnoughToBeWorthCrawling() {
        // A word count, not a smoke test. "Low value content" is a judgement about
        // substance, so the guard has to be about substance — a page that renders its
        // tags but has been hollowed out to a sentence would pass every check above.
        for (String key : List.of("home", "weather", "games", "about")) {
            String text = controller.editorialPage(key).getBody().replaceAll("<[^>]+>", " ");

            assertThat(text.trim().split("\\s+"))
                    .as("word count of editorial page: %s", key)
                    .hasSizeGreaterThan(250);
        }
    }

    @Test
    void homeDeclaresTheSiteNameAndMatchesTheHeadingVisitorsSee() {
        String html = controller.editorialPage("home").getBody();

        // Without this Google inferred the site name and rendered the result under
        // "db-world.in", the bare hostname.
        assertThat(html)
                .contains("\"@type\":\"WebSite\"")
                .contains("\"name\":\"DB World\"");

        // Must equal DashboardIntro's signed-out heading, which reads the same field.
        // These were "DB World" here and "Everything you use, in one hub" on screen —
        // two different h1s on one URL.
        assertThat(html).contains("<h1>Everything you use, in one hub</h1>");
    }

    @Test
    void onlyHomeCarriesTheWebSiteDeclaration() {
        // Repeating it per page adds nothing and invites conflicting names.
        for (String key : List.of("weather", "games", "about")) {
            assertThat(controller.editorialPage(key).getBody())
                    .as("site-name JSON-LD should not appear on: %s", key)
                    .doesNotContain("\"@type\":\"WebSite\"");
        }
    }

    @Test
    void unknownEditorialPageIs404() {
        // Rather than an empty 200, which is a soft-404 and exactly the kind of thin
        // page this whole exercise is removing.
        assertThat(controller.editorialPage("no-such-page").getStatusCode().value()).isEqualTo(404);
    }
}
