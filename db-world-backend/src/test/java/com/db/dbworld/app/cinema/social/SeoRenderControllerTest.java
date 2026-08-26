package com.db.dbworld.app.cinema.social;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.enums.RecordVisibility;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
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
        controller = new SeoRenderController(recordRepository, ipoListingRepository);
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
                .contains("<link rel=\"canonical\" href=\"https://db-world.in/db-world/db-cinema/movie/123-inception\">");
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
                .contains("/db-world/db-cinema/series/456-breaking-bad");
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
                .contains("<link rel=\"canonical\" href=\"https://db-world.in/db-world/ipo/acme-industries\">");
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
                .contains("href=\"https://db-world.in/db-world/ipo/acme-industries\"")
                .contains("Acme Industries IPO");
    }
}
