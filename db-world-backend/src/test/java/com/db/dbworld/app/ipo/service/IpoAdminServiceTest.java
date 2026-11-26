package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.admin.scheduler.service.SchedulerAdminService;
import com.db.dbworld.app.ipo.dto.IpoChangeDto;
import com.db.dbworld.app.ipo.dto.IpoStatusPreviewDto;
import com.db.dbworld.app.ipo.dto.SourceHealthDto;
import com.db.dbworld.app.ipo.entity.IpoChangeEventEntity;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.entity.IpoSourcePollEntity;
import com.db.dbworld.app.ipo.mapper.IpoMapper;
import com.db.dbworld.app.ipo.repository.IpoChangeEventRepository;
import com.db.dbworld.app.ipo.repository.IpoSourcePollRepository;
import com.db.dbworld.app.ipo.scheduler.IpoPollScheduler;
import com.db.dbworld.core.exception.DbWorldException;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class IpoAdminServiceTest {

    private static final Instant NOW = Instant.parse("2026-07-24T12:00:00Z");

    IpoSourcePollRepository sourcePollRepository;
    IpoChangeEventRepository changeEventRepository;
    SchedulerAdminService schedulerAdminService;
    IpoStatusSweepService sweepService;
    SettingsService settings;
    IpoAdminService service;

    @BeforeEach
    void setUp() {
        sourcePollRepository = mock(IpoSourcePollRepository.class);
        changeEventRepository = mock(IpoChangeEventRepository.class);
        schedulerAdminService = mock(SchedulerAdminService.class);
        sweepService = mock(IpoStatusSweepService.class);
        settings = mock(SettingsService.class);
        service = new IpoAdminService(sourcePollRepository, changeEventRepository,
                schedulerAdminService, new IpoMapper(), sweepService, settings,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void statusPreview_flagsListingsAlreadyPastThePublicHideWindow() {
        IpoListingEntity recent = IpoListingEntity.builder().id("r").companyName("Recent")
                .listingDate(LocalDate.of(2026, 7, 20)).build();
        IpoListingEntity old = IpoListingEntity.builder().id("o").companyName("Old")
                .listingDate(LocalDate.of(2026, 6, 1)).build();
        when(settings.getLong(ConfigKeys.IPO_LIST_HIDE_LISTED_AFTER_DAYS)).thenReturn(30L);
        when(sweepService.preview()).thenReturn(List.of(
                new IpoStatusSweepService.PlannedChange(recent, "closed", "listed", false),
                new IpoStatusSweepService.PlannedChange(old, "closed", "listed", false)));

        IpoStatusPreviewDto.Report report = service.statusPreview();

        assertThat(report.hideListedAfterDays()).isEqualTo(30);
        assertThat(report.changes()).extracting(IpoStatusPreviewDto.Row::id, IpoStatusPreviewDto.Row::hiddenFromPublicList)
                .containsExactly(tuple("r", false), tuple("o", true));
    }

    @Test
    void statusPreview_hideDisabled_neverFlagsHidden() {
        IpoListingEntity old = IpoListingEntity.builder().id("o").listingDate(LocalDate.of(2025, 1, 1)).build();
        when(settings.getLong(ConfigKeys.IPO_LIST_HIDE_LISTED_AFTER_DAYS)).thenReturn(0L);
        when(sweepService.preview()).thenReturn(List.of(
                new IpoStatusSweepService.PlannedChange(old, "closed", "listed", false)));

        assertThat(service.statusPreview().changes()).singleElement()
                .satisfies(r -> assertThat(r.hiddenFromPublicList()).isFalse());
    }

    @Test
    void sourceHealth_mapsEveryRow() {
        IpoSourcePollEntity ipoguru = IpoSourcePollEntity.builder()
                .source("ipoguru").lastPolledAt(NOW).lastSuccessAt(NOW)
                .lastStatus("OK").consecutiveFailures(0).build();
        IpoSourcePollEntity nse = IpoSourcePollEntity.builder()
                .source("nse").lastPolledAt(NOW).lastSuccessAt(null)
                .lastStatus("FAILED").consecutiveFailures(3).build();
        when(sourcePollRepository.findAll()).thenReturn(List.of(ipoguru, nse));

        List<SourceHealthDto> result = service.sourceHealth();

        assertThat(result).containsExactly(
                new SourceHealthDto("ipoguru", NOW, NOW, "OK", 0),
                new SourceHealthDto("nse", NOW, null, "FAILED", 3));
    }

    @Test
    void sourceHealth_noRows_returnsEmptyList() {
        when(sourcePollRepository.findAll()).thenReturn(List.of());

        assertThat(service.sourceHealth()).isEmpty();
    }

    @Test
    void recentChanges_mapsTop50InRepositoryOrder() {
        IpoChangeEventEntity e1 = IpoChangeEventEntity.builder()
                .id("1").ipoId("ipo-1").eventType("GMP_JUMP")
                .oldValue("10").newValue("25").createdAt(NOW).build();
        when(changeEventRepository.findTop50ByOrderByCreatedAtDesc()).thenReturn(List.of(e1));

        List<IpoChangeDto> result = service.recentChanges();

        assertThat(result).containsExactly(
                new IpoChangeDto("1", "ipo-1", "GMP_JUMP", "10", "25", NOW));
    }

    @Test
    void recentChangesPage_normalizesTypeAndClampsLimit() {
        when(changeEventRepository.findFeedPage(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any())).thenReturn(List.of());

        service.recentChanges(" status ", NOW, "event-1", 5_000);
        service.recentChanges("  ", null, null, 0);

        org.mockito.Mockito.verify(changeEventRepository)
                .findFeedPage("STATUS", NOW, "event-1", org.springframework.data.domain.Limit.of(200));
        org.mockito.Mockito.verify(changeEventRepository)
                .findFeedPage(null, null, null, org.springframework.data.domain.Limit.of(1));
    }

    @Test
    void repoll_delegatesToSchedulerTriggerWithIpoPollJobId() {
        when(schedulerAdminService.triggerNow(IpoPollScheduler.JOB_ID)).thenReturn(true);

        service.repoll();

        verify(schedulerAdminService).triggerNow("ipo-poll");
    }

    @Test
    void repoll_schedulerReportsNotStarted_throwsConflict() {
        when(schedulerAdminService.triggerNow(IpoPollScheduler.JOB_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.repoll())
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("already running");
    }
}
