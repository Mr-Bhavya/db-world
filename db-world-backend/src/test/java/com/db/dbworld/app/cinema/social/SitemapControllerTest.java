package com.db.dbworld.app.cinema.social;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.enums.RecordVisibility;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.app.cinema.tmdb.genre.entity.GenreEntity;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SitemapControllerTest {

    private static final String BASE = "https://db-world.in";

    @Mock RecordRepository recordRepository;
    @Mock IpoListingRepository ipoListingRepository;

    SitemapController controller;

    @BeforeEach
    void setUp() {
        controller = new SitemapController(recordRepository, ipoListingRepository);
        ReflectionTestUtils.setField(controller, "publicBaseUrl", BASE);
    }

    /* ===============================
       HELPERS
       =============================== */

    private TmdbEntity tmdb(String title) {
        TmdbEntity t = new TmdbEntity();
        t.setTitle(title);
        return t;
    }

    private RecordEntity record(long id, String name, RecordType type, RecordVisibility visibility) {
        return RecordEntity.builder()
                .id(id).name(name).type(type).visibility(visibility).tmdb(tmdb(name))
                .build();
    }

    private GenreEntity genre(long id, String name) {
        GenreEntity g = new GenreEntity();
        g.setId(id);
        g.setName(name);
        return g;
    }

    private RecordEntity dated(long id, String name, Instant published, Instant updated, Instant created) {
        return RecordEntity.builder()
                .id(id).name(name).type(RecordType.MOVIE).visibility(RecordVisibility.PUBLISHED)
                .tmdb(tmdb(name))
                .publishedAt(published).updatedAt(updated).createdAt(created)
                .build();
    }

    private String xml() {
        return controller.sitemap().getBody();
    }

    /* ===============================
       HAPPY PATH
       =============================== */

    @Test
    void doesNotListIndividualRecordPages() {
        when(recordRepository.findAllWithTmdbAndTags()).thenReturn(List.of(
                record(123L, "Inception", RecordType.MOVIE, RecordVisibility.PUBLISHED),
                record(456L, "Breaking Bad", RecordType.TV_SERIES, RecordVisibility.PUBLISHED)));
        when(ipoListingRepository.findAll()).thenReturn(List.of());

        // Deliberate, and the single biggest lever on the "low value content" verdict
        // Google returned in September 2026: every word on a record page comes from
        // TMDB, and ~2,300 of them were 89% of this file. They stay crawlable and
        // ad-eligible — SeoRenderController marks them noindex,follow — but submitting
        // them was asking to be judged on scraped metadata.
        assertThat(xml())
                .doesNotContain("/db-cinema/movie/123")
                .doesNotContain("/db-cinema/series/456");
    }

    @Test
    void listsLandingAndEditorialPages() {
        when(recordRepository.findAllWithTmdbAndTags()).thenReturn(List.of(
                record(123L, "Inception", RecordType.MOVIE, RecordVisibility.PUBLISHED),
                record(456L, "Breaking Bad", RecordType.TV_SERIES, RecordVisibility.PUBLISHED)));
        when(ipoListingRepository.findAll()).thenReturn(List.of());

        String xml = xml();

        assertThat(xml)
                .startsWith("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")
                .contains("<loc>https://db-world.in/db-cinema/browse</loc>")
                .contains("<loc>https://db-world.in/db-ipo</loc>")
                // Legal pages — AdSense needs these discoverable, not just footer-linked.
                .contains("<loc>https://db-world.in/privacy</loc>")
                .contains("<loc>https://db-world.in/terms</loc>")
                .contains("<loc>https://db-world.in/contact</loc>")
                .contains("<loc>https://db-world.in/about</loc>")
                .endsWith("</urlset>\n");
    }

    @Test
    void unlistedRecordsStillCountTowardsTheLandingPages() {
        when(recordRepository.findAllWithTmdbAndTags()).thenReturn(List.of(
                dated(7L, "Deep Cut", Instant.parse("2026-04-09T10:00:00Z"), null, null)));
        when(ipoListingRepository.findAll()).thenReturn(List.of());

        // This used to assert that an UNLISTED record got its own sitemap entry. No
        // record gets one any more. What survives is that such a title still moves the
        // browse page's lastmod, because it genuinely did change that listing.
        assertThat(xml())
                .doesNotContain("/db-cinema/movie/7")
                .contains("<lastmod>2026-04-09</lastmod>");
    }

    @Test
    void includesIpoListings() {
        when(recordRepository.findAllWithTmdbAndTags()).thenReturn(List.of());
        IpoListingEntity ipo = new IpoListingEntity();
        ipo.setId("acme-industries");
        when(ipoListingRepository.findAll()).thenReturn(List.of(ipo));

        assertThat(xml()).contains("<loc>https://db-world.in/db-ipo/acme-industries</loc>");
    }

    /* ===============================
       DISCLOSURE
       =============================== */

    @Test
    void draftRecordsAreNeverListed() {
        when(recordRepository.findAllWithTmdbAndTags()).thenReturn(List.of(
                record(999L, "Unreleased Thing", RecordType.MOVIE, RecordVisibility.DRAFT)));
        when(ipoListingRepository.findAll()).thenReturn(List.of());

        String xml = xml();

        assertThat(xml).doesNotContain("999");
        assertThat(xml).doesNotContain("unreleased-thing");
    }

    @Test
    void recordWithNullVisibilityIsSkippedRatherThanThrowing() {
        when(recordRepository.findAllWithTmdbAndTags()).thenReturn(List.of(
                record(5L, "Legacy Row", RecordType.MOVIE, null)));
        when(ipoListingRepository.findAll()).thenReturn(List.of());

        assertThat(xml()).doesNotContain("legacy-row");
    }

    /* ===============================
       EDGE CASES
       =============================== */

    @Test
    void genreNameWithUrlSignificantCharactersIsSlugified() {
        // This used to assert the same thing about a record title. Record URLs left the
        // sitemap, but slugify() did not — the genre landing pages still build their
        // paths with it, and those are now the deepest cinema URLs submitted, so this
        // is where the escaping has to hold.
        RecordEntity r = record(42L, "Some Film", RecordType.MOVIE, RecordVisibility.PUBLISHED);
        r.getTmdb().setGenres(List.of(genre(878L, "Sci-Fi & Fantasy")));

        when(recordRepository.findAllWithTmdbAndTags()).thenReturn(List.of(r));
        when(ipoListingRepository.findAll()).thenReturn(List.of());

        assertThat(xml())
                .contains("/db-cinema/movie/genre/878-sci-fi-fantasy")
                .doesNotContain("&amp;amp;");
    }

    /* ===============================
       LASTMOD
       =============================== */

    @Test
    void recordLastModComesFromPublishedAt() {
        when(recordRepository.findAllWithTmdbAndTags()).thenReturn(List.of(
                dated(1L, "Published Title",
                        Instant.parse("2026-03-15T10:00:00Z"),
                        Instant.parse("2026-08-01T10:00:00Z"),
                        Instant.parse("2026-01-01T10:00:00Z"))));
        when(ipoListingRepository.findAll()).thenReturn(List.of());

        // publishedAt wins over updatedAt on purpose: updatedAt is touched by every
        // TMDB re-sync even when the page has not changed.
        assertThat(xml()).contains("<lastmod>2026-03-15</lastmod>")
                         .doesNotContain("<lastmod>2026-08-01</lastmod>");
    }

    @Test
    void fallsBackToUpdatedAtThenCreatedAtForRowsPredatingPublishedAt() {
        when(ipoListingRepository.findAll()).thenReturn(List.of());

        // One record per case, asserted separately. Before record URLs left the sitemap
        // both fallbacks could be checked in a single pass, because each record carried
        // its own <lastmod>. Now the only place a record's date surfaces is the landing
        // pages' newest-of, so two records in one run would let the newer one hide
        // whether the older one resolved its date at all.
        when(recordRepository.findAllWithTmdbAndTags()).thenReturn(List.of(
                dated(1L, "No Published Date", null,
                        Instant.parse("2026-05-20T10:00:00Z"),
                        Instant.parse("2026-01-01T10:00:00Z"))));
        assertThat(xml()).contains("<lastmod>2026-05-20</lastmod>");

        when(recordRepository.findAllWithTmdbAndTags()).thenReturn(List.of(
                dated(2L, "Only Created", null, null,
                        Instant.parse("2026-02-02T10:00:00Z"))));
        assertThat(xml()).contains("<lastmod>2026-02-02</lastmod>");
    }

    @Test
    void omitsLastModEntirelyWhenNoDateIsKnown() {
        when(recordRepository.findAllWithTmdbAndTags()).thenReturn(List.of(
                dated(1L, "Undated", null, null, null)));
        when(ipoListingRepository.findAll()).thenReturn(List.of());

        // An invented date is worse than an absent one - Google stops trusting the
        // field if it moves without the page changing.
        assertThat(xml()).doesNotContain("<lastmod>");
    }

    @Test
    void landingPagesCarryTheNewestTitleOfTheirOwnType() {
        when(recordRepository.findAllWithTmdbAndTags()).thenReturn(List.of(
                dated(1L, "Older Movie", Instant.parse("2026-01-10T10:00:00Z"), null, null),
                dated(2L, "Newer Movie", Instant.parse("2026-06-30T10:00:00Z"), null, null),
                RecordEntity.builder()
                        .id(3L).name("A Series").type(RecordType.TV_SERIES)
                        .visibility(RecordVisibility.PUBLISHED).tmdb(tmdb("A Series"))
                        .publishedAt(Instant.parse("2026-04-04T10:00:00Z"))
                        .build()));
        when(ipoListingRepository.findAll()).thenReturn(List.of());

        String xml = xml();

        // /movie takes the newest MOVIE, /tv-shows the newest SERIES, /browse the newest of all.
        assertThat(xml).containsSubsequence(
                "<loc>https://db-world.in/db-cinema/browse</loc>",
                "<lastmod>2026-06-30</lastmod>",
                "<loc>https://db-world.in/db-cinema/movie</loc>",
                "<lastmod>2026-06-30</lastmod>",
                "<loc>https://db-world.in/db-cinema/tv-shows</loc>",
                "<lastmod>2026-04-04</lastmod>");
    }

    @Test
    void draftRecordsDoNotInfluenceLandingPageLastMod() {
        when(recordRepository.findAllWithTmdbAndTags()).thenReturn(List.of(
                dated(1L, "Public", Instant.parse("2026-01-10T10:00:00Z"), null, null),
                RecordEntity.builder()
                        .id(2L).name("Draft").type(RecordType.MOVIE)
                        .visibility(RecordVisibility.DRAFT).tmdb(tmdb("Draft"))
                        .publishedAt(Instant.parse("2026-09-09T10:00:00Z"))
                        .build()));
        when(ipoListingRepository.findAll()).thenReturn(List.of());

        assertThat(xml()).doesNotContain("2026-09-09");
    }

    @Test
    void ipoWithBlankIdIsSkipped() {
        when(recordRepository.findAllWithTmdbAndTags()).thenReturn(List.of());
        IpoListingEntity blank = new IpoListingEntity();
        blank.setId("  ");
        when(ipoListingRepository.findAll()).thenReturn(List.of(blank));

        assertThat(xml()).doesNotContain("/db-ipo/  ");
    }
}
