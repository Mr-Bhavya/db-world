package com.db.dbworld.app.system.health.alert;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.system.health.HostHealthService;
import com.db.dbworld.app.system.health.dto.HostHealthReport;
import com.db.dbworld.app.system.health.dto.HostHealthReport.Check;
import com.db.dbworld.app.system.health.dto.HostHealthReport.Counts;
import com.db.dbworld.core.push.PushService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class HostHealthMonitorTest {

    @Mock HostHealthService healthService;
    @Mock SettingsService   settings;
    @Mock PushService       pushService;

    private HostHealthMonitor monitor;

    @BeforeEach
    void setUp() {
        when(settings.getBoolean(ConfigKeys.SYSTEM_HEALTH_ALERTS_ENABLED)).thenReturn(true);
        when(settings.getBoolean(ConfigKeys.SYSTEM_HEALTH_ALERT_ON_WARN)).thenReturn(false);
        Clock clock = Clock.fixed(Instant.parse("2026-10-04T11:15:00Z"), ZoneOffset.UTC);
        monitor = new HostHealthMonitor(healthService, new HostHealthAlertPolicy(), settings, pushService, clock);
    }

    private static HostHealthReport reportWith(String status) {
        return new HostHealthReport(true, null, false, 60L, "/var/lib/dbworld/health/doctor.json",
                1, "dbworldpi", "2026-10-04T16:45:00+05:30", 1_791_112_500L, 900L, status,
                new Counts(0, 0, 1, 0),
                List.of(new Check("smart.hdd", "Disks", "Media disk SMART", status,
                        "2 reallocated sectors", "", "sudo smartctl -a /dev/sda")));
    }

    @Test
    void aNewFailure_isPushedToAdmins_deepLinkingToSystemInfo() {
        when(healthService.read()).thenReturn(reportWith("fail"));

        monitor.check();

        verify(pushService).broadcastToAdmins(
                "Pi: Media disk SMART",
                "2 reallocated sectors — sudo smartctl -a /dev/sda",
                Map.of("route", "admin/system-info", "link", "/db-world/admin/system-info"),
                "admin");
    }

    @Test
    void stateCarriesOverBetweenRuns_soAnOngoingFailureIsPushedOnce() {
        when(healthService.read()).thenReturn(reportWith("fail"));

        monitor.check();
        monitor.check();
        monitor.check();

        verify(pushService, times(1)).broadcastToAdmins(anyString(), anyString(), anyMap(), anyString());
        assertThat(monitor.state().active()).containsKey("smart.hdd");
    }

    @Test
    void alertsSwitchedOff_sendNothing() {
        when(settings.getBoolean(ConfigKeys.SYSTEM_HEALTH_ALERTS_ENABLED)).thenReturn(false);
        when(healthService.read()).thenReturn(reportWith("fail"));

        monitor.check();

        verify(pushService, never()).broadcastToAdmins(any(), any(), any(), any());
    }

    @Test
    void aPushFailure_doesNotLoseTheState() {
        when(healthService.read()).thenReturn(reportWith("fail"));
        doThrow(new IllegalStateException("FCM down"))
                .when(pushService).broadcastToAdmins(any(), any(), any(), eq("admin"));

        assertThatCode(monitor::check).doesNotThrowAnyException();
        // Best-effort delivery, as for every other admin push: the failure is logged, and the
        // check is not re-announced every five minutes because one send failed.
        assertThat(monitor.state().active()).containsKey("smart.hdd");
    }

    @Test
    void aReaderFailure_isSwallowed() {
        when(healthService.read()).thenThrow(new IllegalStateException("boom"));

        assertThatCode(monitor::check).doesNotThrowAnyException();
        verify(pushService, never()).broadcastToAdmins(any(), any(), any(), any());
    }
}
