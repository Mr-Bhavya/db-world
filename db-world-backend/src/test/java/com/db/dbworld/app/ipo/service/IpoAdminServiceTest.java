package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.admin.scheduler.service.SchedulerAdminService;
import com.db.dbworld.app.ipo.dto.IpoChangeDto;
import com.db.dbworld.app.ipo.dto.SourceHealthDto;
import com.db.dbworld.app.ipo.entity.IpoChangeEventEntity;
import com.db.dbworld.app.ipo.entity.IpoSourcePollEntity;
import com.db.dbworld.app.ipo.mapper.IpoMapper;
import com.db.dbworld.app.ipo.repository.IpoChangeEventRepository;
import com.db.dbworld.app.ipo.repository.IpoSourcePollRepository;
import com.db.dbworld.app.ipo.scheduler.IpoPollScheduler;
import com.db.dbworld.core.exception.DbWorldException;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class IpoAdminServiceTest {

    private static final Instant NOW = Instant.parse("2026-07-24T12:00:00Z");

    IpoSourcePollRepository sourcePollRepository;
    IpoChangeEventRepository changeEventRepository;
    SchedulerAdminService schedulerAdminService;
    IpoAdminService service;

    @BeforeEach
    void setUp() {
        sourcePollRepository = mock(IpoSourcePollRepository.class);
        changeEventRepository = mock(IpoChangeEventRepository.class);
        schedulerAdminService = mock(SchedulerAdminService.class);
        service = new IpoAdminService(sourcePollRepository, changeEventRepository,
                schedulerAdminService, new IpoMapper());
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
                new IpoChangeDto("ipo-1", "GMP_JUMP", "10", "25", NOW));
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
