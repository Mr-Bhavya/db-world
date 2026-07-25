package com.db.dbworld.app.ipo.scheduler;

import com.db.dbworld.app.ipo.dto.IpoDto;
import com.db.dbworld.app.ipo.scheduler.IpoPollScheduler.IpoPollResult;
import com.db.dbworld.app.ipo.service.IpoIngestService;
import com.db.dbworld.app.ipo.service.IpoMergeService;
import com.db.dbworld.app.ipo.service.IpoSourcePollService;
import com.db.dbworld.app.ipo.source.IpoSource;
import com.db.dbworld.app.ipo.source.IpoSourceRegistry;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IpoPollSchedulerTest {

    private static final Instant NOW = Instant.parse("2026-07-24T12:00:00Z");

    @Mock IpoSourceRegistry registry;
    @Mock IpoMergeService mergeService;
    @Mock IpoIngestService ingestService;
    @Mock IpoSourcePollService pollService;

    private IpoPollScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new IpoPollScheduler(registry, mergeService, ingestService, pollService, () -> NOW);
    }

    private static IpoSource fakeSuccess(String key, List<IpoDto> dtos) {
        IpoSource s = mock(IpoSource.class);
        when(s.key()).thenReturn(key);
        when(s.fetchAll()).thenReturn(dtos);
        return s;
    }

    private static IpoSource fakeThrows(String key) {
        IpoSource s = mock(IpoSource.class);
        when(s.key()).thenReturn(key);
        when(s.fetchAll()).thenThrow(new RuntimeException("upstream blew up"));
        return s;
    }

    /** All-null dto except source/companyName — merge/ingest are mocked, so field values don't matter. */
    private static IpoDto dto(String source) {
        return new IpoDto(source, null, "Co-" + source, null, null,
                null, null, null, null,
                null, null, null, null,
                null, null, null,
                null, null, null, null, null, null,
                null, null, null, null, null);
    }

    @Test
    void pollOnce_allSourcesSucceed_fetchesMergesIngestsAndRecordsSuccessPerSource() {
        IpoDto d1 = dto("ipoguru");
        IpoDto d2 = dto("nse");
        IpoDto d3 = dto("chittorgarh");
        IpoSource ipoguru = fakeSuccess("ipoguru", List.of(d1));
        IpoSource nse = fakeSuccess("nse", List.of(d2));
        IpoSource chittorgarh = fakeSuccess("chittorgarh", List.of(d3));
        when(registry.enabled()).thenReturn(List.of(ipoguru, nse, chittorgarh));

        List<IpoDto> mergedResult = List.of(d1, d2, d3);
        when(mergeService.merge(anyList())).thenReturn(mergedResult);

        IpoPollResult result = scheduler.pollOnce();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<IpoDto>> captor = ArgumentCaptor.forClass(List.class);
        verify(mergeService).merge(captor.capture());
        assertThat(captor.getValue()).containsExactlyInAnyOrder(d1, d2, d3);
        verify(ingestService).ingest(mergedResult);

        verify(pollService).recordSuccess("ipoguru", NOW);
        verify(pollService).recordSuccess("nse", NOW);
        verify(pollService).recordSuccess("chittorgarh", NOW);
        verify(pollService, never()).recordFailure(any(), any(), any());

        assertThat(result.sourcesPolled()).isEqualTo(3);
        assertThat(result.sourcesFailed()).isZero();
        assertThat(result.ipoCount()).isEqualTo(3);
    }

    @Test
    void pollOnce_oneSourceThrows_othersStillFetchedMergedAndIngested_noAbort() {
        IpoDto d2 = dto("nse");
        IpoDto d3 = dto("chittorgarh");
        IpoSource ipoguru = fakeThrows("ipoguru");
        IpoSource nse = fakeSuccess("nse", List.of(d2));
        IpoSource chittorgarh = fakeSuccess("chittorgarh", List.of(d3));
        when(registry.enabled()).thenReturn(List.of(ipoguru, nse, chittorgarh));

        List<IpoDto> mergedResult = List.of(d2, d3);
        when(mergeService.merge(anyList())).thenReturn(mergedResult);

        IpoPollResult result = scheduler.pollOnce();

        verify(pollService).recordFailure("ipoguru", NOW, "FAILED");
        verify(pollService, never()).recordSuccess(eq("ipoguru"), any());
        verify(pollService).recordSuccess("nse", NOW);
        verify(pollService).recordSuccess("chittorgarh", NOW);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<IpoDto>> captor = ArgumentCaptor.forClass(List.class);
        verify(mergeService).merge(captor.capture());
        assertThat(captor.getValue()).containsExactlyInAnyOrder(d2, d3);
        verify(ingestService).ingest(mergedResult);

        assertThat(result.sourcesPolled()).isEqualTo(3);
        assertThat(result.sourcesFailed()).isEqualTo(1);
        assertThat(result.ipoCount()).isEqualTo(2);
    }

    @Test
    void pollOnce_emptyEnabledList_mergeCalledWithEmptyList_ingestCalledWithMergeOutput_noPollServiceCalls() {
        when(registry.enabled()).thenReturn(List.of());
        when(mergeService.merge(List.of())).thenReturn(List.of());

        IpoPollResult result = scheduler.pollOnce();

        verify(mergeService).merge(List.of());
        verify(ingestService).ingest(List.of());
        verifyNoInteractions(pollService);

        assertThat(result.sourcesPolled()).isZero();
        assertThat(result.sourcesFailed()).isZero();
        assertThat(result.ipoCount()).isZero();
    }
}
