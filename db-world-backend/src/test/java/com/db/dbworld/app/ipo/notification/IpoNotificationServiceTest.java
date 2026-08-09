package com.db.dbworld.app.ipo.notification;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.notification.IpoLifecycleChange.Kind;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.core.push.PushService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
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
    @Mock IpoMarketCalendar marketCalendar;

    private static final Instant NOW = Instant.parse("2026-07-24T06:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    private IpoNotificationService service() {
        return new IpoNotificationService(pushService, settings, listingRepo, marketCalendar, clock);
    }

    /** Stub the market-calendar gate open, so tests exercising an actual send aren't suppressed by it. */
    private void inWindow() {
        when(marketCalendar.isNotificationWindow(any())).thenReturn(true);
    }

    @Test
    void dispatch_nullOrEmpty_sendsNothing() {
        service().dispatch(null);
        service().dispatch(List.of());
        verifyNoInteractions(pushService);
    }

    @Test
    void dispatch_opened_broadcastsWithDeepLinkData() {
        inWindow();
        service().dispatch(List.of(IpoLifecycleChange.of("ipo1", "Acme", Kind.OPENED)));
        verify(pushService).broadcast(
                contains("is open"),
                any(),
                argThat(m -> "ipo1".equals(m.get("ipoId")) && "OPENED".equals(m.get("kind"))),
                eq("ipo"));
    }

    @Test
    void dispatch_gmpJumpBelowThreshold_notSent() {
        inWindow();
        when(settings.getLong(ConfigKeys.IPO_GMP_NOTIFY_THRESHOLD_PCT)).thenReturn(10L);
        // 100 → 105 = a 5% move, below the 10% threshold → suppressed.
        service().dispatch(List.of(new IpoLifecycleChange("ipo1", "Acme", Kind.GMP_JUMP, "100", "105")));
        verify(pushService, never()).broadcast(any(), any(), any(), any());
    }

    @Test
    void dispatch_gmpJumpAtOrAboveThreshold_sent() {
        inWindow();
        when(settings.getLong(ConfigKeys.IPO_GMP_NOTIFY_THRESHOLD_PCT)).thenReturn(10L);
        // 100 → 125 = a 25% move → broadcast, body carries the new value.
        service().dispatch(List.of(new IpoLifecycleChange("ipo1", "Acme", Kind.GMP_JUMP, "100", "125")));
        verify(pushService).broadcast(contains("GMP"), contains("₹125"), any(), eq("ipo"));
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

        verify(pushService).broadcast(contains("closing soon"), any(), any(), eq("ipo"));
        assertThat(ipo.getClosingSoonNotifiedAt()).isEqualTo(NOW);
        verify(listingRepo).save(ipo);
    }

    @Test
    void dispatch_outsideMarketWindow_suppressesEverything() {
        // Overnight / weekend / holiday: the calendar gate is closed, so a would-be "IPO is open"
        // push (the 12 AM case) is skipped entirely — the change stays persisted, only the push is held.
        when(marketCalendar.isNotificationWindow(any())).thenReturn(false);

        service().dispatch(List.of(IpoLifecycleChange.of("ipo1", "Acme", Kind.OPENED)));

        verify(pushService, never()).broadcast(any(), any(), any(), any());
    }

    @Test
    void notifyClosingSoon_outsideMarketWindow_sendsNothingAndSkipsQuery() {
        // Gate closed → return before touching the repo, so no reminder goes out and (crucially) no
        // dedupe marker is stamped, leaving the reminder to fire at the next in-window poll.
        when(marketCalendar.isNotificationWindow(any())).thenReturn(false);

        service().notifyClosingSoon();

        verifyNoInteractions(pushService, listingRepo);
    }
}
