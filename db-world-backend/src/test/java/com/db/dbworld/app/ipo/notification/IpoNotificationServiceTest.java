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

    /** Stub the market-calendar gate open, so tests exercising an actual send aren't suppressed by it. */
    private void inWindow() {
        when(marketCalendar.isNotificationWindow(any())).thenReturn(true);
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
        verify(changeEventRepo).save(event);
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
        verify(changeEventRepo).save(event);
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
        when(settings.getLong(ConfigKeys.IPO_GMP_NOTIFY_THRESHOLD_PCT)).thenReturn(10L);
        IpoListingEntity ipo = todayIstListing();
        ipo.setOpenDate(LocalDate.of(2026, 1, 5));
        ipo.setListingDate(null);
        stubPending(ipo, pendingEvent("GMP", "100", "125"));

        service().dispatchPending();

        verify(pushService).broadcast(contains("GMP"), any(), any(), eq("ipo"));
    }

    @Test
    void dispatchPending_gmpJumpBelowThreshold_notSentButStamped() {
        inWindow();
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
        when(settings.getLong(ConfigKeys.IPO_GMP_NOTIFY_THRESHOLD_PCT)).thenReturn(10L);
        // 100 → 125 = a 25% move → broadcast, body carries the new value.
        stubPending(pendingEvent("GMP", "100", "125"));

        service().dispatchPending();

        verify(pushService).broadcast(contains("GMP"), contains("₹125"), any(), eq("ipo"));
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
        verify(listingRepo).save(ipo);
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
}
