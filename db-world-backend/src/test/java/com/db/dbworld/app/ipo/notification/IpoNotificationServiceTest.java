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

    private static final Instant NOW = Instant.parse("2026-07-24T06:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    private IpoNotificationService service() {
        return new IpoNotificationService(pushService, settings, listingRepo, clock);
    }

    @Test
    void dispatch_nullOrEmpty_sendsNothing() {
        service().dispatch(null);
        service().dispatch(List.of());
        verifyNoInteractions(pushService);
    }

    @Test
    void dispatch_opened_broadcastsWithDeepLinkData() {
        service().dispatch(List.of(IpoLifecycleChange.of("ipo1", "Acme", Kind.OPENED)));
        verify(pushService).broadcastIpo(
                contains("is open"),
                any(),
                argThat(m -> "ipo1".equals(m.get("ipoId")) && "OPENED".equals(m.get("kind"))));
    }

    @Test
    void dispatch_gmpJumpBelowThreshold_notSent() {
        when(settings.getLong(ConfigKeys.IPO_GMP_NOTIFY_THRESHOLD_PCT)).thenReturn(10L);
        // 100 → 105 = a 5% move, below the 10% threshold → suppressed.
        service().dispatch(List.of(new IpoLifecycleChange("ipo1", "Acme", Kind.GMP_JUMP, "100", "105")));
        verify(pushService, never()).broadcastIpo(any(), any(), any());
    }

    @Test
    void dispatch_gmpJumpAtOrAboveThreshold_sent() {
        when(settings.getLong(ConfigKeys.IPO_GMP_NOTIFY_THRESHOLD_PCT)).thenReturn(10L);
        // 100 → 125 = a 25% move → broadcast, body carries the new value.
        service().dispatch(List.of(new IpoLifecycleChange("ipo1", "Acme", Kind.GMP_JUMP, "100", "125")));
        verify(pushService).broadcastIpo(contains("GMP"), contains("₹125"), any());
    }

    @Test
    void notifyClosingSoon_broadcastsAndStampsDedupeMarker() {
        IpoListingEntity ipo = new IpoListingEntity();
        ipo.setId("ipo1");
        ipo.setCompanyName("Acme");
        ipo.setStatus("open");
        when(listingRepo.findByStatusAndCloseDateBetweenAndClosingSoonNotifiedAtIsNull(eq("open"), any(), any()))
                .thenReturn(List.of(ipo));

        service().notifyClosingSoon();

        verify(pushService).broadcastIpo(contains("closing soon"), any(), any());
        assertThat(ipo.getClosingSoonNotifiedAt()).isEqualTo(NOW);
        verify(listingRepo).save(ipo);
    }
}
