package com.db.dbworld.app.home.service;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalogrequest.entity.CatalogIngestRequestStatus;
import com.db.dbworld.app.cinema.catalogrequest.service.CatalogIngestRequestService;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.enums.RecordVisibility;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestStatus;
import com.db.dbworld.app.cinema.mediarequest.service.MediaRequestService;
import com.db.dbworld.app.cinema.notification.repository.UserNotificationRepository;
import com.db.dbworld.app.cinema.progress.dto.ContinueWatchingDto;
import com.db.dbworld.app.cinema.progress.service.WatchProgressService;
import com.db.dbworld.app.cinema.tmdb.entities.MovieTmdbEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.app.home.dto.HomeSummaryDto;
import com.db.dbworld.app.ipo.dto.IpoListResponse;
import com.db.dbworld.app.ipo.dto.IpoSummaryDto;
import com.db.dbworld.app.ipo.service.IpoQueryService;
import com.db.dbworld.app.pm.repository.PasswordManagerRepository;
import com.db.dbworld.app.wallet.entity.WalletDocumentEntity;
import com.db.dbworld.app.wallet.repository.WalletDocumentRepository;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.security.dto.CurrentUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * What the hub's one-shot summary contains for each kind of caller, and — the part that matters
 * most for a landing page — that a broken subsystem costs one widget rather than the whole page.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class HomeSummaryServiceTest {

    /** 2026-08-28 12:00 IST, so "today" in the service is a fixed, known date. */
    private static final Clock FIXED_CLOCK =
            Clock.fixed(Instant.parse("2026-08-28T06:30:00Z"), ZoneId.of("UTC"));
    private static final LocalDate TODAY = LocalDate.of(2026, 8, 28);

    private static final Long USER_ID = 7L;

    @Mock private IpoQueryService ipoQueryService;
    @Mock private RecordRepository recordRepository;
    @Mock private WatchProgressService watchProgressService;
    @Mock private WalletDocumentRepository walletDocumentRepository;
    @Mock private PasswordManagerRepository passwordManagerRepository;
    @Mock private UserNotificationRepository notificationRepository;
    @Mock private MediaRequestService mediaRequestService;
    @Mock private CatalogIngestRequestService catalogIngestRequestService;
    @Mock private UserContext userContext;

    private HomeSummaryService service;

    @BeforeEach
    void setUp() {
        service = new HomeSummaryService(ipoQueryService, recordRepository, watchProgressService,
                walletDocumentRepository, passwordManagerRepository, notificationRepository,
                mediaRequestService, catalogIngestRequestService, userContext, FIXED_CLOCK);

        when(ipoQueryService.list(any(), any(), any()))
                .thenReturn(new IpoListResponse(List.of(), Instant.now(FIXED_CLOCK)));
        when(recordRepository.findLatestPublished(any())).thenReturn(List.of());
        when(recordRepository.countByVisibility(RecordVisibility.PUBLISHED)).thenReturn(0L);
    }

    /* ── Who sees what ───────────────────────────────────────────────────────────────────────── */

    @Test
    void anonymousVisitorGetsPublicSectionsOnly() {
        when(userContext.optionalUser()).thenReturn(Optional.empty());

        HomeSummaryDto summary = service.summary();

        assertThat(summary.authenticated()).isFalse();
        assertThat(summary.ipo()).isNotNull();
        assertThat(summary.cinema()).isNotNull();
        assertThat(summary.wallet()).isNull();
        assertThat(summary.vault()).isNull();
        assertThat(summary.notifications()).isNull();
        assertThat(summary.admin()).isNull();
    }

    /** The user-scoped repositories must not even be touched for an anonymous caller. */
    @Test
    void anonymousVisitorTriggersNoUserScopedQueries() {
        when(userContext.optionalUser()).thenReturn(Optional.empty());

        service.summary();

        verify(walletDocumentRepository, never()).countByUserId(anyLong());
        verify(passwordManagerRepository, never()).countByUserEntityUserId(anyLong());
        verify(notificationRepository, never()).countByRecipientUserIdAndReadFalse(anyLong());
        verify(watchProgressService, never()).getContinueWatching(anyLong());
    }

    @Test
    void signedInViewerGetsUserSectionsButNotAdmin() {
        signedInAs("VIEWER");
        when(passwordManagerRepository.countByUserEntityUserId(USER_ID)).thenReturn(42L);
        when(notificationRepository.countByRecipientUserIdAndReadFalse(USER_ID)).thenReturn(3L);

        HomeSummaryDto summary = service.summary();

        assertThat(summary.authenticated()).isTrue();
        assertThat(summary.vault().total()).isEqualTo(42L);
        assertThat(summary.notifications().unread()).isEqualTo(3L);
        assertThat(summary.wallet()).isNotNull();
        assertThat(summary.admin()).isNull();
    }

    @Test
    void adminAlsoGetsThePendingRequestQueue() {
        signedInAs("ADMIN");
        when(mediaRequestService.countByStatus(MediaRequestStatus.PENDING)).thenReturn(5L);
        when(catalogIngestRequestService.countByStatus(CatalogIngestRequestStatus.PENDING)).thenReturn(2L);

        HomeSummaryDto summary = service.summary();

        assertThat(summary.admin().pendingMediaRequests()).isEqualTo(5L);
        assertThat(summary.admin().pendingCatalogRequests()).isEqualTo(2L);
    }

    @Test
    void ownerCountsAsAdmin() {
        signedInAs("OWNER");

        assertThat(service.summary().admin()).isNotNull();
    }

    /* ── IPO section ─────────────────────────────────────────────────────────────────────────── */

    @Test
    void ipoSectionCountsOpenAndUpcomingAndPicksTheSoonestClose() {
        when(userContext.optionalUser()).thenReturn(Optional.empty());
        when(ipoQueryService.list(any(), any(), any())).thenReturn(new IpoListResponse(List.of(
                ipo("a", "Alpha", "open", TODAY.plusDays(3), new BigDecimal("12.0")),
                ipo("b", "Bravo", "open", TODAY.plusDays(1), new BigDecimal("4.0")),
                ipo("c", "Charlie", "upcoming", TODAY.plusDays(9), new BigDecimal("8.0")),
                ipo("d", "Delta", "closed", TODAY.minusDays(2), new BigDecimal("2.0"))
        ), Instant.now(FIXED_CLOCK)));

        HomeSummaryDto.IpoSection ipo = service.summary().ipo();

        assertThat(ipo.open()).isEqualTo(2);
        assertThat(ipo.upcoming()).isEqualTo(1);
        assertThat(ipo.closingSoon().id()).isEqualTo("b");
        assertThat(ipo.topGmp().id()).isEqualTo("a");
    }

    /**
     * A listed IPO's GMP is history — headlining it would put a number on the tile that nobody
     * can act on, so the top-GMP pick only considers open and upcoming issues.
     */
    @Test
    void topGmpIgnoresAlreadyListedIssues() {
        when(userContext.optionalUser()).thenReturn(Optional.empty());
        when(ipoQueryService.list(any(), any(), any())).thenReturn(new IpoListResponse(List.of(
                ipo("hot", "Hot Listing", "listed", TODAY.minusDays(5), new BigDecimal("90.0")),
                ipo("live", "Live Issue", "open", TODAY.plusDays(2), new BigDecimal("11.0"))
        ), Instant.now(FIXED_CLOCK)));

        assertThat(service.summary().ipo().topGmp().id()).isEqualTo("live");
    }

    /** The large tile's list: open issues first by soonest close, then upcoming by open date. */
    @Test
    void actionableListsOpenIssuesBySoonestCloseThenUpcoming() {
        when(userContext.optionalUser()).thenReturn(Optional.empty());
        when(ipoQueryService.list(any(), any(), any())).thenReturn(new IpoListResponse(List.of(
                ipo("later-open", "Later Open", "open", TODAY.plusDays(5), new BigDecimal("3")),
                ipo("upcoming", "Upcoming Co", "upcoming", TODAY.plusDays(20), new BigDecimal("9")),
                ipo("soon-open", "Soon Open", "open", TODAY.plusDays(1), new BigDecimal("4")),
                ipo("listed", "Old Listing", "listed", TODAY.minusDays(9), new BigDecimal("55"))
        ), Instant.now(FIXED_CLOCK)));

        assertThat(service.summary().ipo().actionable())
                .extracting(HomeSummaryDto.IpoHighlight::id)
                .containsExactly("soon-open", "later-open", "upcoming");
    }

    @Test
    void actionableIsCappedSoTheTileNeverHasToScroll() {
        when(userContext.optionalUser()).thenReturn(Optional.empty());
        when(ipoQueryService.list(any(), any(), any())).thenReturn(new IpoListResponse(
                java.util.stream.IntStream.range(0, 9)
                        .mapToObj(i -> ipo("i" + i, "Issue " + i, "open",
                                TODAY.plusDays(i + 1), new BigDecimal("5")))
                        .toList(),
                Instant.now(FIXED_CLOCK)));

        assertThat(service.summary().ipo().actionable()).hasSize(4);
    }

    @Test
    void ipoSectionSurvivesAnEmptyList() {
        when(userContext.optionalUser()).thenReturn(Optional.empty());

        HomeSummaryDto.IpoSection ipo = service.summary().ipo();

        assertThat(ipo.open()).isZero();
        assertThat(ipo.closingSoon()).isNull();
        assertThat(ipo.topGmp()).isNull();
        assertThat(ipo.actionable()).isEmpty();
    }

    /* ── Cinema section ──────────────────────────────────────────────────────────────────────── */

    @Test
    void cinemaSectionMapsLatestTitlesAndResumePoint() {
        signedInAs("VIEWER");
        when(recordRepository.findLatestPublished(any())).thenReturn(List.of(record(11L, "Dune", "/dune.jpg")));
        when(recordRepository.countByVisibility(RecordVisibility.PUBLISHED)).thenReturn(1234L);
        when(recordRepository.countByVisibilityAndType(RecordVisibility.PUBLISHED, RecordType.MOVIE))
                .thenReturn(800L);
        when(recordRepository.countByVisibilityAndType(RecordVisibility.PUBLISHED, RecordType.TV_SERIES))
                .thenReturn(434L);
        when(recordRepository.countByVisibilityAndPublishedAtAfter(eq(RecordVisibility.PUBLISHED), any()))
                .thenReturn(12L);
        when(watchProgressService.getContinueWatching(USER_ID)).thenReturn(List.of(
                ContinueWatchingDto.builder()
                        .recordId(99L).title("The Wire").type("TV_SERIES").posterPath("/wire.jpg")
                        .season(2).episode(4).positionMs(1_800_000L).durationMs(3_600_000L)
                        .build()
        ));

        HomeSummaryDto.CinemaSection cinema = service.summary().cinema();

        assertThat(cinema.publishedTitles()).isEqualTo(1234L);
        assertThat(cinema.movies()).isEqualTo(800L);
        assertThat(cinema.series()).isEqualTo(434L);
        assertThat(cinema.addedThisWeek()).isEqualTo(12L);
        assertThat(cinema.latest()).singleElement().satisfies(t -> {
            assertThat(t.name()).isEqualTo("Dune");
            assertThat(t.posterPath()).isEqualTo("/dune.jpg");
            assertThat(t.type()).isEqualTo("MOVIE");
        });
        assertThat(cinema.continueWatching().progressPct()).isEqualTo(50);
        assertThat(cinema.continueWatching().episode()).isEqualTo(4);
    }

    /**
     * A queued next episode has a known position of 0 and an unknown duration of 0. That has to
     * read as "not started" rather than dividing by zero.
     */
    @Test
    void resumeProgressIsZeroWhenDurationIsUnknown() {
        signedInAs("VIEWER");
        when(watchProgressService.getContinueWatching(USER_ID)).thenReturn(List.of(
                ContinueWatchingDto.builder()
                        .recordId(99L).title("Next Up").type("TV_SERIES")
                        .positionMs(0L).durationMs(0L)
                        .build()
        ));

        assertThat(service.summary().cinema().continueWatching().progressPct()).isZero();
    }

    /** A title with no TMDB row still has a name of its own; the tile must not render blank. */
    @Test
    void latestTitleFallsBackToTheRecordNameWithoutTmdb() {
        when(userContext.optionalUser()).thenReturn(Optional.empty());
        when(recordRepository.findLatestPublished(any())).thenReturn(List.of(
                RecordEntity.builder().id(5L).name("Untagged Film").type(RecordType.MOVIE).build()
        ));

        HomeSummaryDto.CinemaTitle title = service.summary().cinema().latest().getFirst();

        assertThat(title.name()).isEqualTo("Untagged Film");
        assertThat(title.posterPath()).isNull();
    }

    /** The window is measured from the injected clock, so the figure is reproducible. */
    @Test
    void addedThisWeekCountsFromSevenDaysBeforeNow() {
        when(userContext.optionalUser()).thenReturn(Optional.empty());

        service.summary();

        ArgumentCaptor<Instant> since = ArgumentCaptor.forClass(Instant.class);
        verify(recordRepository)
                .countByVisibilityAndPublishedAtAfter(eq(RecordVisibility.PUBLISHED), since.capture());

        assertThat(since.getValue()).isEqualTo(Instant.now(FIXED_CLOCK).minus(Duration.ofDays(7)));
    }

    /* ── Wallet section ──────────────────────────────────────────────────────────────────────── */

    @Test
    void walletSectionCountsAgainstTodayAndTheThirtyDayWindow() {
        signedInAs("VIEWER");
        when(walletDocumentRepository.countByUserId(USER_ID)).thenReturn(8L);
        when(walletDocumentRepository.countByUserIdAndExpiryDateBetween(
                USER_ID, TODAY, TODAY.plusDays(30))).thenReturn(2L);
        when(walletDocumentRepository.countByUserIdAndExpiryDateBefore(USER_ID, TODAY)).thenReturn(1L);
        when(walletDocumentRepository.findByUserIdAndExpiryDateGreaterThanEqualOrderByExpiryDateAsc(
                eq(USER_ID), eq(TODAY), any())).thenReturn(List.of(walletDoc("Driving Licence", TODAY.plusDays(12))));

        HomeSummaryDto.WalletSection wallet = service.summary().wallet();

        assertThat(wallet.total()).isEqualTo(8L);
        assertThat(wallet.expiringSoon()).isEqualTo(2L);
        assertThat(wallet.expired()).isEqualTo(1L);
        assertThat(wallet.next().label()).isEqualTo("Driving Licence");
        assertThat(wallet.next().daysLeft()).isEqualTo(12L);
    }

    @Test
    void walletSectionHasNoNextExpiryWhenNothingIsDated() {
        signedInAs("VIEWER");
        when(walletDocumentRepository.findByUserIdAndExpiryDateGreaterThanEqualOrderByExpiryDateAsc(
                anyLong(), any(), any())).thenReturn(List.of());

        assertThat(service.summary().wallet().next()).isNull();
    }

    /* ── Resilience ──────────────────────────────────────────────────────────────────────────── */

    /**
     * The hub is the landing page. One dead subsystem must cost one widget, not a 500 for every
     * visitor and every crawler.
     */
    @Test
    void aFailingSectionIsOmittedRatherThanFailingTheWholeResponse() {
        signedInAs("VIEWER");
        when(ipoQueryService.list(any(), any(), any()))
                .thenThrow(new IllegalStateException("IPO source unreachable"));

        HomeSummaryDto summary = service.summary();

        assertThat(summary.ipo()).isNull();
        assertThat(summary.cinema()).isNotNull();
        assertThat(summary.vault()).isNotNull();
    }

    @Test
    void everySectionCanFailWithoutThrowing() {
        signedInAs("ADMIN");
        when(ipoQueryService.list(any(), any(), any())).thenThrow(new IllegalStateException("down"));
        when(recordRepository.findLatestPublished(any())).thenThrow(new IllegalStateException("down"));
        when(walletDocumentRepository.countByUserId(anyLong())).thenThrow(new IllegalStateException("down"));
        when(passwordManagerRepository.countByUserEntityUserId(anyLong())).thenThrow(new IllegalStateException("down"));
        when(notificationRepository.countByRecipientUserIdAndReadFalse(anyLong())).thenThrow(new IllegalStateException("down"));
        when(mediaRequestService.countByStatus(any())).thenThrow(new IllegalStateException("down"));

        HomeSummaryDto summary = service.summary();

        assertThat(summary.authenticated()).isTrue();
        assertThat(summary.ipo()).isNull();
        assertThat(summary.cinema()).isNull();
        assertThat(summary.wallet()).isNull();
        assertThat(summary.vault()).isNull();
        assertThat(summary.notifications()).isNull();
        assertThat(summary.admin()).isNull();
    }

    /* ── Fixtures ────────────────────────────────────────────────────────────────────────────── */

    private void signedInAs(String role) {
        when(userContext.optionalUser())
                .thenReturn(Optional.of(new CurrentUser(USER_ID, "user@db-world.in", role)));
    }

    private static IpoSummaryDto ipo(String id, String name, String status,
                                     LocalDate closeDate, BigDecimal gmpPct) {
        return new IpoSummaryDto(
                id, name, "mainboard", status,
                closeDate == null ? null : closeDate.minusDays(2), closeDate, null,
                null, null, null, gmpPct, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null
        );
    }

    private static RecordEntity record(Long id, String title, String posterPath) {
        TmdbEntity tmdb = new MovieTmdbEntity();
        tmdb.setTitle(title);
        tmdb.setPosterPath(posterPath);

        RecordEntity record = RecordEntity.builder()
                .id(id).name(title).type(RecordType.MOVIE).build();
        record.setTmdb(tmdb);
        return record;
    }

    private static WalletDocumentEntity walletDoc(String label, LocalDate expiryDate) {
        WalletDocumentEntity doc = new WalletDocumentEntity();
        doc.setId("doc-1");
        doc.setLabel(label);
        doc.setExpiryDate(expiryDate);
        return doc;
    }
}
