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

    private String xml() {
        return controller.sitemap().getBody();
    }

    /* ===============================
       HAPPY PATH
       =============================== */

    @Test
    void listsLandingPagesAndPublishedRecords() {
        when(recordRepository.findAllWithTmdbAndTags()).thenReturn(List.of(
                record(123L, "Inception", RecordType.MOVIE, RecordVisibility.PUBLISHED),
                record(456L, "Breaking Bad", RecordType.TV_SERIES, RecordVisibility.PUBLISHED)));
        when(ipoListingRepository.findAll()).thenReturn(List.of());

        String xml = xml();

        assertThat(xml)
                .startsWith("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")
                .contains("<loc>https://db-world.in/db-world/db-cinema/browse</loc>")
                .contains("<loc>https://db-world.in/db-world/db-ipo</loc>")
                // Legal pages — AdSense needs these discoverable, not just footer-linked.
                .contains("<loc>https://db-world.in/db-world/privacy</loc>")
                .contains("<loc>https://db-world.in/db-world/terms</loc>")
                .contains("<loc>https://db-world.in/db-world/contact</loc>")
                // Slug mirrors recordNav.js: leading id, cosmetic title.
                .contains("<loc>https://db-world.in/db-world/db-cinema/movie/123-inception</loc>")
                .contains("<loc>https://db-world.in/db-world/db-cinema/series/456-breaking-bad</loc>")
                .endsWith("</urlset>\n");
    }

    @Test
    void unlistedRecordsAreIncluded_theyAreReachableByDirectLink() {
        when(recordRepository.findAllWithTmdbAndTags()).thenReturn(List.of(
                record(7L, "Deep Cut", RecordType.MOVIE, RecordVisibility.UNLISTED)));
        when(ipoListingRepository.findAll()).thenReturn(List.of());

        assertThat(xml()).contains("/db-world/db-cinema/movie/7-deep-cut");
    }

    @Test
    void includesIpoListings() {
        when(recordRepository.findAllWithTmdbAndTags()).thenReturn(List.of());
        IpoListingEntity ipo = new IpoListingEntity();
        ipo.setId("acme-industries");
        when(ipoListingRepository.findAll()).thenReturn(List.of(ipo));

        assertThat(xml()).contains("<loc>https://db-world.in/db-world/db-ipo/acme-industries</loc>");
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
    void titleWithUrlSignificantCharactersIsSlugified() {
        when(recordRepository.findAllWithTmdbAndTags()).thenReturn(List.of(
                record(42L, "Fast & Furious: Tokyo Drift", RecordType.MOVIE, RecordVisibility.PUBLISHED)));
        when(ipoListingRepository.findAll()).thenReturn(List.of());

        assertThat(xml())
                .contains("/db-world/db-cinema/movie/42-fast-furious-tokyo-drift")
                .doesNotContain("&amp;amp;");
    }

    @Test
    void ipoWithBlankIdIsSkipped() {
        when(recordRepository.findAllWithTmdbAndTags()).thenReturn(List.of());
        IpoListingEntity blank = new IpoListingEntity();
        blank.setId("  ");
        when(ipoListingRepository.findAll()).thenReturn(List.of(blank));

        assertThat(xml()).doesNotContain("/db-world/db-ipo/  ");
    }
}
