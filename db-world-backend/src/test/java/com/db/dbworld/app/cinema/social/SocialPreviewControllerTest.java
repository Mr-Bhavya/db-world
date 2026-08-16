package com.db.dbworld.app.cinema.social;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.enums.RecordVisibility;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SocialPreviewControllerTest {

    private static final String BASE = "https://db-world.in";

    @Mock RecordRepository recordRepository;

    SocialPreviewController controller;

    @BeforeEach
    void setUp() {
        controller = new SocialPreviewController(recordRepository);
        ReflectionTestUtils.setField(controller, "publicBaseUrl", BASE);
        ReflectionTestUtils.setField(controller, "fallbackImage", "/icons/icon-192.png");
    }

    /* ===============================
       HELPERS
       =============================== */

    private TmdbEntity tmdb(String title, String overview, String backdrop, String poster, String date) {
        TmdbEntity t = new TmdbEntity();
        t.setTitle(title);
        t.setOverview(overview);
        t.setBackdropPath(backdrop);
        t.setPosterPath(poster);
        t.setPrimaryDate(date);
        return t;
    }

    private RecordEntity record(long id, String name, RecordType type,
                                RecordVisibility visibility, TmdbEntity tmdb) {
        return RecordEntity.builder()
                .id(id).name(name).type(type).visibility(visibility).tmdb(tmdb)
                .build();
    }

    private String bodyFor(long id, String type) {
        return controller.recordPreview(type, id).getBody();
    }

    /* ===============================
       HAPPY PATH
       =============================== */

    @Test
    void movie_rendersRecordSpecificOpenGraphTags() {
        when(recordRepository.findByIdWithTmdb(123L)).thenReturn(Optional.of(
                record(123L, "Inception", RecordType.MOVIE, RecordVisibility.PUBLISHED,
                        tmdb("Inception", "A thief who steals corporate secrets.",
                                "/backdrop.jpg", "/poster.jpg", "2010-07-16"))));

        String html = bodyFor(123L, "movie");

        assertThat(html)
                .contains("""
                        <meta property="og:title"       content="Inception (2010)" />""")
                .contains("A thief who steals corporate secrets.")
                .contains("https://image.tmdb.org/t/p/w1280/backdrop.jpg")
                .contains("""
                        <meta property="og:type"        content="video.movie" />""")
                .contains(BASE + "/db-world/db-cinema/movie/123-inception")
                .contains("summary_large_image");

        // The generic site card must NOT leak through on a successful lookup.
        assertThat(html).doesNotContain("Stream, download and manage movies");
    }

    @Test
    void series_usesTvShowTypeAndSeriesSegment() {
        when(recordRepository.findByIdWithTmdb(45L)).thenReturn(Optional.of(
                record(45L, "Loki", RecordType.TV_SERIES, RecordVisibility.PUBLISHED,
                        tmdb("Loki", "The God of Mischief steps out.",
                                "/loki.jpg", null, "2021-06-09"))));

        String html = bodyFor(45L, "series");

        assertThat(html)
                .contains("video.tv_show")
                .contains(BASE + "/db-world/db-cinema/series/45-loki")
                .contains("Loki (2021)");
    }

    @Test
    void unlistedRecord_isPreviewable() {
        // UNLISTED is public-by-direct-link, which is exactly the share case.
        when(recordRepository.findByIdWithTmdb(9L)).thenReturn(Optional.of(
                record(9L, "Deep Cut", RecordType.MOVIE, RecordVisibility.UNLISTED,
                        tmdb("Deep Cut", "Off the rails.", "/dc.jpg", null, "2019-01-01"))));

        assertThat(bodyFor(9L, "movie")).contains("Deep Cut (2019)");
    }

    /* ===============================
       VISIBILITY / DISCLOSURE
       =============================== */

    @Test
    void draftRecord_isIndistinguishableFromNotFound() {
        when(recordRepository.findByIdWithTmdb(7L)).thenReturn(Optional.of(
                record(7L, "Unreleased Secret", RecordType.MOVIE, RecordVisibility.DRAFT,
                        tmdb("Unreleased Secret", "Internal only.", "/s.jpg", null, "2030-01-01"))));
        when(recordRepository.findByIdWithTmdb(999L)).thenReturn(Optional.empty());

        String draft = bodyFor(7L, "movie");
        String missing = bodyFor(999L, "movie");

        // No fragment of the unpublished record may appear.
        assertThat(draft)
                .doesNotContain("Unreleased Secret")
                .doesNotContain("Internal only")
                .doesNotContain("/s.jpg");
        // Byte-identical, so a share link cannot probe for unpublished titles.
        assertThat(draft).isEqualTo(missing);
        assertThat(draft).contains("DB World").contains("icons/icon-192.png");
    }

    @Test
    void nullVisibility_isTreatedAsNotPublic() {
        // The column is nullable so the additive migration could backfill.
        when(recordRepository.findByIdWithTmdb(3L)).thenReturn(Optional.of(
                record(3L, "Legacy Row", RecordType.MOVIE, null,
                        tmdb("Legacy Row", "Pre-migration.", "/l.jpg", null, "2015-01-01"))));

        assertThat(bodyFor(3L, "movie")).doesNotContain("Legacy Row");
    }

    /* ===============================
       FALLBACKS
       =============================== */

    @Test
    void noTmdb_fallsBackToRecordNameAndSiteImage() {
        when(recordRepository.findByIdWithTmdb(11L)).thenReturn(Optional.of(
                record(11L, "Raw Import", RecordType.MOVIE, RecordVisibility.PUBLISHED, null)));

        assertThat(bodyFor(11L, "movie"))
                .contains("Raw Import")
                .contains(BASE + "/icons/icon-192.png")
                .contains(BASE + "/db-world/db-cinema/movie/11-raw-import");
    }

    @Test
    void noBackdrop_fallsBackToPoster() {
        when(recordRepository.findByIdWithTmdb(12L)).thenReturn(Optional.of(
                record(12L, "Poster Only", RecordType.MOVIE, RecordVisibility.PUBLISHED,
                        tmdb("Poster Only", "Desc.", null, "/poster.jpg", "2020-01-01"))));

        assertThat(bodyFor(12L, "movie"))
                .contains("https://image.tmdb.org/t/p/w500/poster.jpg")
                .doesNotContain("w1280");
    }

    @Test
    void blankOverview_fallsBackToSiteDescription() {
        when(recordRepository.findByIdWithTmdb(13L)).thenReturn(Optional.of(
                record(13L, "No Synopsis", RecordType.MOVIE, RecordVisibility.PUBLISHED,
                        tmdb("No Synopsis", "   ", "/b.jpg", null, "2020-01-01"))));

        assertThat(bodyFor(13L, "movie")).contains("Stream, download and manage");
    }

    @Test
    void missingDate_omitsYearSuffix() {
        when(recordRepository.findByIdWithTmdb(14L)).thenReturn(Optional.of(
                record(14L, "Undated", RecordType.MOVIE, RecordVisibility.PUBLISHED,
                        tmdb("Undated", "Desc.", "/b.jpg", null, null))));

        assertThat(bodyFor(14L, "movie"))
                .contains("""
                        <meta property="og:title"       content="Undated" />""");
    }

    /* ===============================
       ESCAPING / SLUGS
       =============================== */

    @Test
    void titleWithMarkup_isHtmlEscaped() {
        when(recordRepository.findByIdWithTmdb(66L)).thenReturn(Optional.of(
                record(66L, "x", RecordType.MOVIE, RecordVisibility.PUBLISHED,
                        tmdb("<script>alert(1)</script>", "\"quoted\" & <b>bold</b>",
                                "/b.jpg", null, "2020-01-01"))));

        String html = bodyFor(66L, "movie");

        assertThat(html)
                .doesNotContain("<script>alert(1)</script>")
                .contains("&lt;script&gt;")
                .contains("&amp;");
    }

    @Test
    void titleWithUrlUnsafeChars_producesCleanSlug() {
        // Titles containing / ? # & ' used to corrupt the path — see recordNav.js.
        when(recordRepository.findByIdWithTmdb(77L)).thenReturn(Optional.of(
                record(77L, "x", RecordType.MOVIE, RecordVisibility.PUBLISHED,
                        tmdb("Mission: Impossible — Dead Reckoning, Pt. 1",
                                "Desc.", "/b.jpg", null, "2023-07-12"))));

        assertThat(bodyFor(77L, "movie"))
                .contains("/db-world/db-cinema/movie/77-mission-impossible-dead-reckoning-pt-1");
    }

    @Test
    void nonAlphanumericTitle_fallsBackToBareId() {
        when(recordRepository.findByIdWithTmdb(88L)).thenReturn(Optional.of(
                record(88L, "x", RecordType.MOVIE, RecordVisibility.PUBLISHED,
                        tmdb("!!!", "Desc.", "/b.jpg", null, "2020-01-01"))));

        assertThat(bodyFor(88L, "movie")).contains("/db-world/db-cinema/movie/88\"");
    }

    /* ===============================
       RESPONSE SHAPE
       =============================== */

    @Test
    void response_isCacheableHtml() {
        when(recordRepository.findByIdWithTmdb(1L)).thenReturn(Optional.empty());

        var response = controller.recordPreview("movie", 1L);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getHeaders().getContentType().toString()).startsWith("text/html");
        assertThat(response.getHeaders().getCacheControl()).contains("max-age=600");
    }

    @Test
    void pathTypeSegment_doesNotOverrideActualRecordType() {
        // nginx passes whatever segment the sharer's URL had; the DB is the source of truth.
        when(recordRepository.findByIdWithTmdb(21L)).thenReturn(Optional.of(
                record(21L, "Loki", RecordType.TV_SERIES, RecordVisibility.PUBLISHED,
                        tmdb("Loki", "Desc.", "/b.jpg", null, "2021-01-01"))));

        assertThat(bodyFor(21L, "movie"))
                .contains("video.tv_show")
                .contains("/db-cinema/series/21-loki");
    }
}
