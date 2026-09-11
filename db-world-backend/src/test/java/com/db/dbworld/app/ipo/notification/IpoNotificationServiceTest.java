package com.db.dbworld.app.ipo.notification;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.ipo.entity.IpoChangeEventEntity;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.repository.IpoChangeEventRepository;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.core.push.PushService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IpoNotificationServiceTest {

    @Mock PushService pushService;
    @Mock SettingsService settings;
    @Mock IpoListingRepository listingRepo;
    @Mock IpoChangeEventRepository changeEventRepo;
    @Mock IpoMarketCalendar marketCalendar;

    private static final Instant NOW = Instant.parse("2026-07-24T06:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    private IpoNotificationService service() {
        return serviceAt(clock);
    }

    private IpoNotificationService serviceAt(Clock at) {
        return new IpoNotificationService(pushService, settings, listingRepo, changeEventRepo, marketCalendar, at);
    }

    /**
     * Neutralise every volume control by default, so each test exercises exactly the one gate it
     * names. Lenient because most tests trip only a subset of these. Note the one exception:
     * {@code IPO_GMP_NOTIFY_ENABLED} is left at its real production default of FALSE, because "GMP
     * does not push unless you ask for it" is itself behaviour worth failing a test over.
     */
    @org.junit.jupiter.api.BeforeEach
    void permissiveVolumeSettings() {
        org.mockito.Mockito.lenient().when(settings.getBoolean(ConfigKeys.IPO_GMP_NOTIFY_ENABLED)).thenReturn(false);
        org.mockito.Mockito.lenient().when(settings.getLong(ConfigKeys.IPO_NOTIFY_COOLDOWN_HOURS)).thenReturn(0L);
        org.mockito.Mockito.lenient().when(settings.getLong(ConfigKeys.IPO_NOTIFY_MAX_PER_DAY)).thenReturn(0L);
        org.mockito.Mockito.lenient().when(settings.getLong(ConfigKeys.IPO_NOTIFY_DIGEST_THRESHOLD)).thenReturn(99L);
        org.mockito.Mockito.lenient().when(settings.getLong(ConfigKeys.IPO_GMP_NOTIFY_MIN_ABSOLUTE)).thenReturn(0L);
    }

    /** Opt this test into GMP pushes, which ship disabled. */
    private void gmpPushesOn() {
        when(settings.getBoolean(ConfigKeys.IPO_GMP_NOTIFY_ENABLED)).thenReturn(true);
    }

    /** Stub the market-calendar gate open, so tests exercising an actual send aren't suppressed by it. */
    private void inWindow() {
        when(marketCalendar.isNotificationWindow(any())).thenReturn(true);
    }

    /** A pending event for a specific IPO id — the multi-IPO digest/cap tests need distinct ids. */
    private static IpoChangeEventEntity pendingEventFor(String ipoId, String type, String newValue) {
        return IpoChangeEventEntity.builder()
                .id("evt-" + ipoId).ipoId(ipoId).eventType(type).newValue(newValue).createdAt(NOW).build();
    }

    /** A listing whose dates make every alert current news as of NOW. */
    private static IpoListingEntity listing(String id, String name) {
        IpoListingEntity ipo = new IpoListingEntity();
        ipo.setId(id);
        ipo.setCompanyName(name);
        ipo.setOpenDate(LocalDate.of(2026, 7, 24));
        ipo.setListingDate(LocalDate.of(2026, 7, 24));
        ipo.setAllotmentDate(LocalDate.of(2026, 7, 24));
        return ipo;
    }

    /** A pending (never-notified) change event, created "now" so it's inside MAX_PENDING_AGE. */
    private static IpoChangeEventEntity pendingEvent(String type, String oldValue, String newValue) {
        return IpoChangeEventEntity.builder()
                .id("evt-1").ipoId("ipo1").eventType(type)
                .oldValue(oldValue).newValue(newValue)
                .createdAt(NOW)
                .build();
    }

    /** Queue {@code events} as pending and make ipo1 resolve to a listing that opened/listed today. */
    private void stubPending(IpoChangeEventEntity... events) {
        stubPending(todayIstListing(), events);
    }

    private void stubPending(IpoListingEntity ipo, IpoChangeEventEntity... events) {
        when(changeEventRepo.findByEventTypeInAndNotifiedAtIsNullOrderByCreatedAtAsc(anyCollection()))
                .thenReturn(List.of(events));
        when(listingRepo.findAllById(any())).thenReturn(List.of(ipo));
    }

    /** NOW is 11:30 AM IST on 2026-07-24, so these dates make every alert current news. */
    private static IpoListingEntity todayIstListing() {
        IpoListingEntity ipo = new IpoListingEntity();
        ipo.setId("ipo1");
        ipo.setCompanyName("Acme");
        ipo.setOpenDate(LocalDate.of(2026, 7, 24));
        ipo.setListingDate(LocalDate.of(2026, 7, 24));
        ipo.setAllotmentDate(LocalDate.of(2026, 7, 24));
        return ipo;
    }

    @Test
    void dispatchPending_nothingQueued_sendsNothing() {
        when(changeEventRepo.findByEventTypeInAndNotifiedAtIsNullOrderByCreatedAtAsc(anyCollection()))
                .thenReturn(List.of());

        service().dispatchPending();

        verifyNoInteractions(pushService);
    }

    @Test
    void dispatchPending_opened_broadcastsWithDeepLinkDataAndStampsEvent() {
        inWindow();
        IpoChangeEventEntity event = pendingEvent("STATUS", "upcoming", "open");
        stubPending(event);

        service().dispatchPending();

        verify(pushService).broadcast(
                contains("is open"),
                any(),
                argThat(m -> "ipo1".equals(m.get("ipoId")) && "OPENED".equals(m.get("kind"))),
                eq("ipo"));
        // Stamped, so no later pass — poll or notify job — can send it a second time.
        assertThat(event.getNotifiedAt()).isEqualTo(NOW);
        verify(changeEventRepo).saveAll(any());
    }

    @Test
    void dispatchPending_outsideMarketWindow_holdsTheQueueInsteadOfDroppingIt() {
        // The whole point of the queue: overnight / weekend / holiday the pass is a no-op and NOTHING
        // is stamped, so the alert goes out at the next in-window pass rather than being lost (the
        // ingest already committed the new status, so no later poll would re-detect the transition).
        when(marketCalendar.isNotificationWindow(any())).thenReturn(false);
        IpoChangeEventEntity event = pendingEvent("STATUS", "upcoming", "open");
        when(changeEventRepo.findByEventTypeInAndNotifiedAtIsNullOrderByCreatedAtAsc(anyCollection()))
                .thenReturn(List.of(event));

        service().dispatchPending();

        verify(pushService, never()).broadcast(any(), any(), any(), any());
        assertThat(event.getNotifiedAt()).isNull();
        verify(changeEventRepo, never()).save(any());
    }

    @Test
    void dispatchPending_eventOlderThanMaxPendingAge_retiredUnsent() {
        // Guards the first run over a pre-existing change history (every historical row reads as
        // pending) and a long outage — stale alerts are retired, not broadcast to every device.
        inWindow();
        IpoChangeEventEntity event = pendingEvent("STATUS", "upcoming", "open");
        event.setCreatedAt(NOW.minusSeconds(19 * 3600)); // 19h old, past the 18h cutoff
        stubPending(event);

        service().dispatchPending();

        verify(pushService, never()).broadcast(any(), any(), any(), any());
        // Still stamped, so it doesn't sit in the queue being re-evaluated forever.
        assertThat(event.getNotifiedAt()).isEqualTo(NOW);
        verify(changeEventRepo).saveAll(any());
    }

    @Test
    void dispatchPending_statusChangeUsersDontHearAbout_stampedButNotSent() {
        // A STATUS event is loaded by the query (it's a notifiable TYPE) but open→closed isn't an
        // alert. It must still be stamped or it would be re-examined on every single pass.
        inWindow();
        IpoChangeEventEntity event = pendingEvent("STATUS", "open", "closed");
        stubPending(event);

        service().dispatchPending();

        verify(pushService, never()).broadcast(any(), any(), any(), any());
        assertThat(event.getNotifiedAt()).isEqualTo(NOW);
    }

    @Test
    void dispatchPending_listingDeleted_stampedButNotSent() {
        inWindow();
        IpoChangeEventEntity event = pendingEvent("STATUS", "upcoming", "open");
        when(changeEventRepo.findByEventTypeInAndNotifiedAtIsNullOrderByCreatedAtAsc(anyCollection()))
                .thenReturn(List.of(event));
        when(listingRepo.findAllById(any())).thenReturn(List.of()); // purged — nothing to name

        service().dispatchPending();

        verify(pushService, never()).broadcast(any(), any(), any(), any());
        assertThat(event.getNotifiedAt()).isEqualTo(NOW);
    }

    @Test
    void dispatchPending_listingHappenedWeeksAgo_suppressedAsOldNews() {
        // MAX_PENDING_AGE bounds how old the event ROW is; this bounds how old the real-world event
        // is. A feed that starts reporting a batch of long-settled IPOs creates fresh rows for
        // ancient facts — one local poll produced 17 "has listed" pushes at once — so without this a
        // deploy would blast the backlog at every device.
        inWindow();
        IpoListingEntity ipo = todayIstListing();
        ipo.setListingDate(LocalDate.of(2026, 7, 1)); // listed 23 days before NOW
        IpoChangeEventEntity event = pendingEvent("STATUS", "closed", "listed");
        stubPending(ipo, event);

        service().dispatchPending();

        verify(pushService, never()).broadcast(any(), any(), any(), any());
        // Stamped, so it isn't re-examined forever — just never announced.
        assertThat(event.getNotifiedAt()).isEqualTo(NOW);
    }

    @Test
    void dispatchPending_listedToday_stillAnnounced() {
        inWindow();
        stubPending(pendingEvent("STATUS", "closed", "listed"));

        service().dispatchPending();

        verify(pushService).broadcast(contains("has listed"), any(), any(), eq("ipo"));
    }

    @Test
    void dispatchPending_gmpJumpIsAlwaysCurrent_notAgeGated() {
        // GMP is a live number, so it has no real-world date to go stale against — an old open date
        // must not suppress it.
        inWindow();
        gmpPushesOn();
        when(settings.getLong(ConfigKeys.IPO_GMP_NOTIFY_THRESHOLD_PCT)).thenReturn(10L);
        IpoListingEntity ipo = todayIstListing();
        ipo.setOpenDate(LocalDate.of(2026, 1, 5));
        ipo.setListingDate(null);
        stubPending(ipo, pendingEvent("GMP", "100", "125"));

        service().dispatchPending();

        verify(pushService).broadcast(contains("GMP"), any(), any(), eq("ipo-gmp"));
    }

    @Test
    void dispatchPending_gmpJumpBelowThreshold_notSentButStamped() {
        inWindow();
        gmpPushesOn();
        when(settings.getLong(ConfigKeys.IPO_GMP_NOTIFY_THRESHOLD_PCT)).thenReturn(10L);
        // 100 → 105 = a 5% move, below the 10% threshold → suppressed.
        IpoChangeEventEntity event = pendingEvent("GMP", "100", "105");
        stubPending(event);

        service().dispatchPending();

        verify(pushService, never()).broadcast(any(), any(), any(), any());
        assertThat(event.getNotifiedAt()).isEqualTo(NOW);
    }

    @Test
    void dispatchPending_gmpJumpAtOrAboveThreshold_sent() {
        inWindow();
        gmpPushesOn();
        when(settings.getLong(ConfigKeys.IPO_GMP_NOTIFY_THRESHOLD_PCT)).thenReturn(10L);
        // 100 → 125 = a 25% move → broadcast, body carries the new value.
        stubPending(pendingEvent("GMP", "100", "125"));

        service().dispatchPending();

        verify(pushService).broadcast(contains("GMP"), contains("₹125"), any(), eq("ipo-gmp"));
    }

    @Test
    void dispatchPending_pushFailure_leavesTheEventPendingForRetry() {
        inWindow();
        IpoChangeEventEntity event = pendingEvent("STATUS", "upcoming", "open");
        stubPending(event);
        org.mockito.Mockito.doThrow(new RuntimeException("FCM down"))
                .when(pushService).broadcast(any(), any(), any(), any());

        service().dispatchPending();

        // Not stamped → the standalone notify job picks it up again next pass.
        assertThat(event.getNotifiedAt()).isNull();
        verify(changeEventRepo, never()).save(any());
        verify(changeEventRepo).saveAll(argThat(it -> !it.iterator().hasNext()));
    }

    @Test
    void notifyClosingSoon_broadcastsAndStampsDedupeMarker() {
        inWindow();
        IpoListingEntity ipo = new IpoListingEntity();
        ipo.setId("ipo1");
        ipo.setCompanyName("Acme");
        ipo.setStatus("open");
        when(listingRepo.findByStatusAndCloseDateBetweenAndClosingSoonNotifiedAtIsNull(eq("open"), any(), any()))
                .thenReturn(List.of(ipo));

        service().notifyClosingSoon();

        verify(pushService).broadcast(contains("closes today"), any(), any(), eq("ipo"));
        assertThat(ipo.getClosingSoonNotifiedAt()).isEqualTo(NOW);
        verify(listingRepo).saveAll(any());
    }

    @Test
    void notifyClosingSoon_queriesTheCloseDayOnly() {
        // The dedupe marker only ever lets this fire ONCE per IPO, so the window must be the close
        // day itself (NOW = 11:30 AM IST on 2026-07-24) — a wider one spent the single "last chance"
        // reminder a day early and then went silent on the actual final day.
        inWindow();
        LocalDate todayIst = LocalDate.of(2026, 7, 24);
        when(listingRepo.findByStatusAndCloseDateBetweenAndClosingSoonNotifiedAtIsNull(
                eq("open"), eq(todayIst), eq(todayIst))).thenReturn(List.of());

        service().notifyClosingSoon();

        verify(listingRepo).findByStatusAndCloseDateBetweenAndClosingSoonNotifiedAtIsNull(
                "open", todayIst, todayIst);
        verify(pushService, never()).broadcast(any(), any(), any(), any());
    }

    @Test
    void notifyClosingSoon_pastTheFivePmCutoff_sendsNothing() {
        // A poll after bidding closed must stay silent rather than push a "last chance to apply"
        // for an issue nobody can apply to any more.
        IpoListingEntity ipo = new IpoListingEntity();
        ipo.setId("ipo1");
        ipo.setCompanyName("Acme");
        ipo.setStatus("open");
        ipo.setCloseDate(LocalDate.of(2026, 7, 24));
        // 2026-07-24T14:00Z = 7:30 PM IST, past the 5 PM close cutoff on the close day.
        when(marketCalendar.isNotificationWindow(any())).thenReturn(true);
        when(listingRepo.findByStatusAndCloseDateBetweenAndClosingSoonNotifiedAtIsNull(eq("open"), any(), any()))
                .thenReturn(List.of(ipo));

        serviceAt(Clock.fixed(Instant.parse("2026-07-24T14:00:00Z"), ZoneOffset.UTC)).notifyClosingSoon();

        verify(pushService, never()).broadcast(any(), any(), any(), any());
        assertThat(ipo.getClosingSoonNotifiedAt()).isNull();
    }

    @Test
    void notifyClosingSoon_outsideMarketWindow_sendsNothingAndSkipsQuery() {
        // Gate closed → return before touching the repo, so no reminder goes out and (crucially) no
        // dedupe marker is stamped, leaving the reminder to fire at the next in-window poll.
        when(marketCalendar.isNotificationWindow(any())).thenReturn(false);

        service().notifyClosingSoon();

        verify(pushService, never()).broadcast(any(), any(), any(), any());
        verifyNoInteractions(listingRepo);
    }

    // ── Volume control ──────────────────────────────────────────────────────────────────────────

    @Test
    void dispatchPending_gmpPushesDisabledByDefault_stampedButNotSent() {
        // The single biggest source of noise: GMP was 20 of the 28 pushes sent in one five-hour
        // window. It ships off — the number is still collected, charted and shown, just not pushed.
        inWindow();
        IpoChangeEventEntity event = pendingEvent("GMP", "100", "400");   // a 300% move
        stubPending(event);

        service().dispatchPending();

        verify(pushService, never()).broadcast(any(), any(), any(), any());
        assertThat(event.getNotifiedAt()).isEqualTo(NOW);
        assertThat(event.getPushedAt()).isNull();
    }

    @Test
    void dispatchPending_gmpMoveClearsPercentButNotRupees_suppressed() {
        // The percentage test alone fires on noise: Rs 3 -> Rs 4 is a 33% jump and one rupee. This
        // is the Prasol Chemicals case from production, GMP Rs 3 at +0.44%.
        inWindow();
        gmpPushesOn();
        when(settings.getLong(ConfigKeys.IPO_GMP_NOTIFY_MIN_ABSOLUTE)).thenReturn(5L);
        when(changeEventRepo.findRecentPushed(eq("ipo1"), eq("GMP"), any())).thenReturn(List.of());
        IpoChangeEventEntity event = pendingEvent("GMP", "3", "4");
        stubPending(event);

        service().dispatchPending();

        verify(pushService, never()).broadcast(any(), any(), any(), any());
        assertThat(event.getNotifiedAt()).isEqualTo(NOW);
    }

    @Test
    void dispatchPending_gmpDriftsPastThresholdRelativeToLastPoll_measuredAgainstLastAnnouncedInstead() {
        // The re-alerting bug. oldValue is the last POLLED value, so a GMP creeping up ~11% a pass
        // cleared a 10% threshold every single pass -- one IPO alerted four times in 3.5 hours.
        // Measured against the last value actually ANNOUNCED (100), 123 -> 137 is 37%: still a real
        // move, so this one SENDS. The next assertion covers the case where it should not.
        inWindow();
        gmpPushesOn();
        when(settings.getLong(ConfigKeys.IPO_GMP_NOTIFY_THRESHOLD_PCT)).thenReturn(50L);
        IpoChangeEventEntity lastAnnounced = pendingEvent("GMP", "90", "100");
        lastAnnounced.setPushedAt(NOW.minusSeconds(3600));
        when(changeEventRepo.findRecentPushed(eq("ipo1"), eq("GMP"), any())).thenReturn(List.of(lastAnnounced));
        // 123 -> 137 is +11% on the last poll, but only +37% on the last ANNOUNCED value, so with a
        // 50% threshold it stays quiet -- where the old comparison would have re-fired.
        IpoChangeEventEntity event = pendingEvent("GMP", "123", "137");
        stubPending(event);

        service().dispatchPending();

        verify(pushService, never()).broadcast(any(), any(), any(), any());
    }

    @Test
    void dispatchPending_ipoAlreadyPushedInsideCooldown_suppressed() {
        inWindow();
        when(settings.getLong(ConfigKeys.IPO_NOTIFY_COOLDOWN_HOURS)).thenReturn(6L);
        IpoChangeEventEntity earlier = pendingEvent("STATUS", "upcoming", "open");
        earlier.setPushedAt(NOW.minusSeconds(3600));   // pushed an hour ago, inside the 6h cooldown
        when(changeEventRepo.findRecentPushed(eq("ipo1"), eq("STATUS"), any())).thenReturn(List.of(earlier));
        IpoChangeEventEntity event = pendingEvent("STATUS", "upcoming", "open");
        stubPending(event);

        service().dispatchPending();

        verify(pushService, never()).broadcast(any(), any(), any(), any());
        assertThat(event.getNotifiedAt()).isEqualTo(NOW);
    }

    @Test
    void dispatchPending_cooldownExpired_sentAgain() {
        inWindow();
        when(settings.getLong(ConfigKeys.IPO_NOTIFY_COOLDOWN_HOURS)).thenReturn(6L);
        IpoChangeEventEntity earlier = pendingEvent("STATUS", "upcoming", "open");
        earlier.setPushedAt(NOW.minusSeconds(7 * 3600));   // 7h ago, outside the cooldown
        when(changeEventRepo.findRecentPushed(eq("ipo1"), eq("STATUS"), any())).thenReturn(List.of(earlier));
        stubPending(pendingEvent("STATUS", "upcoming", "open"));

        service().dispatchPending();

        verify(pushService).broadcast(contains("is open"), any(), any(), eq("ipo"));
    }

    @Test
    void dispatchPending_severalSameKindAlerts_bundledIntoOneDigest() {
        // Production sent five separate "IPO is open" pushes inside 11 seconds. One digest instead.
        inWindow();
        when(settings.getLong(ConfigKeys.IPO_NOTIFY_DIGEST_THRESHOLD)).thenReturn(2L);
        when(changeEventRepo.findByEventTypeInAndNotifiedAtIsNullOrderByCreatedAtAsc(anyCollection()))
                .thenReturn(List.of(pendingEventFor("ipo1", "STATUS", "open"),
                        pendingEventFor("ipo2", "STATUS", "open"),
                        pendingEventFor("ipo3", "STATUS", "open")));
        when(listingRepo.findAllById(any()))
                .thenReturn(List.of(listing("ipo1", "Acme"), listing("ipo2", "Bravo"), listing("ipo3", "Delta")));

        service().dispatchPending();

        // Exactly one push, naming the first two and counting the rest, linking to the list not a row.
        verify(pushService).broadcast(eq("🟢 3 IPOs opened today"),
                contains("Acme, Bravo and 1 more"),
                argThat(m -> "/db-world/db-ipo".equals(m.get("link")) && m.get("ipoId") == null),
                eq("ipo"));
        verify(pushService, org.mockito.Mockito.times(1)).broadcast(any(), any(), any(), any());
    }

    @Test
    void dispatchPending_belowDigestThreshold_stillSentIndividually() {
        // A lone alert must stay a normal, named push -- never "1 IPOs opened today".
        inWindow();
        when(settings.getLong(ConfigKeys.IPO_NOTIFY_DIGEST_THRESHOLD)).thenReturn(2L);
        stubPending(pendingEvent("STATUS", "upcoming", "open"));

        service().dispatchPending();

        verify(pushService).broadcast(contains("Acme"), any(),
                argThat(m -> "ipo1".equals(m.get("ipoId"))), eq("ipo"));
    }

    @Test
    void dispatchPending_dailyCapReached_remainingAlertsDroppedNotQueued() {
        // Dropped rather than held, so a feed glitch cannot empty a backlog onto every device at
        // the start of the next day.
        inWindow();
        when(settings.getLong(ConfigKeys.IPO_NOTIFY_MAX_PER_DAY)).thenReturn(1L);
        when(changeEventRepo.countPushesSince(any())).thenReturn(1L);   // already spent today
        IpoChangeEventEntity event = pendingEvent("STATUS", "upcoming", "open");
        stubPending(event);

        service().dispatchPending();

        verify(pushService, never()).broadcast(any(), any(), any(), any());
        assertThat(event.getNotifiedAt()).isEqualTo(NOW);   // handled, so it never comes back
        assertThat(event.getPushedAt()).isNull();
    }

    @Test
    void dispatchPending_capBites_spendsItOnAllotmentBeforeGmp() {
        // Priority order matters only when the cap bites: an allotment result is a fact a user
        // cannot recover by opening the app later, a GMP wiggle is not.
        inWindow();
        gmpPushesOn();
        when(settings.getLong(ConfigKeys.IPO_NOTIFY_MAX_PER_DAY)).thenReturn(1L);
        when(changeEventRepo.countPushesSince(any())).thenReturn(0L);
        when(changeEventRepo.findRecentPushed(any(), any(), any())).thenReturn(List.of());
        when(changeEventRepo.findByEventTypeInAndNotifiedAtIsNullOrderByCreatedAtAsc(anyCollection()))
                .thenReturn(List.of(pendingEventFor("ipo1", "GMP", "500"),
                        pendingEventFor("ipo2", "ALLOTMENT", "out")));
        when(listingRepo.findAllById(any()))
                .thenReturn(List.of(listing("ipo1", "Acme"), listing("ipo2", "Bravo")));

        service().dispatchPending();

        verify(pushService).broadcast(contains("allotment is out"), any(), any(), eq("ipo"));
        verify(pushService, org.mockito.Mockito.times(1)).broadcast(any(), any(), any(), any());
    }

    @Test
    void dispatchPending_gmpAlertUsesItsOwnChannel_soItCanBeMutedAlone() {
        // One shared "ipo" channel made muting GMP chatter an all-or-nothing choice that also lost
        // allotment and listing alerts.
        inWindow();
        gmpPushesOn();
        when(settings.getLong(ConfigKeys.IPO_GMP_NOTIFY_THRESHOLD_PCT)).thenReturn(10L);
        when(changeEventRepo.findRecentPushed(eq("ipo1"), eq("GMP"), any())).thenReturn(List.of());
        stubPending(pendingEvent("GMP", "100", "125"));

        service().dispatchPending();

        verify(pushService).broadcast(contains("GMP"), any(), any(), eq("ipo-gmp"));
    }

    @Test
    void dispatchPending_sentEvent_stampsPushedAtSoTheCooldownAndCapCanSeeIt() {
        inWindow();
        IpoChangeEventEntity event = pendingEvent("STATUS", "upcoming", "open");
        stubPending(event);

        service().dispatchPending();

        assertThat(event.getPushedAt()).isNotNull();
        assertThat(event.getNotifiedAt()).isEqualTo(NOW);
    }

    @Test
    void notifyClosingSoon_severalClosingSameDay_bundledIntoOneReminder() {
        // Production sent three separate "closes today" pushes in one pass.
        inWindow();
        when(settings.getLong(ConfigKeys.IPO_NOTIFY_DIGEST_THRESHOLD)).thenReturn(2L);
        IpoListingEntity a = listing("ipo1", "Acme");
        IpoListingEntity b = listing("ipo2", "Bravo");
        a.setStatus("open");
        b.setStatus("open");
        when(listingRepo.findByStatusAndCloseDateBetweenAndClosingSoonNotifiedAtIsNull(eq("open"), any(), any()))
                .thenReturn(List.of(a, b));

        service().notifyClosingSoon();

        verify(pushService).broadcast(eq("⏳ 2 IPOs close today"), contains("Acme, Bravo"), any(), eq("ipo"));
        verify(pushService, org.mockito.Mockito.times(1)).broadcast(any(), any(), any(), any());
        // Both marked, so neither is reminded about twice.
        assertThat(a.getClosingSoonNotifiedAt()).isEqualTo(NOW);
        assertThat(b.getClosingSoonNotifiedAt()).isEqualTo(NOW);
    }
}
